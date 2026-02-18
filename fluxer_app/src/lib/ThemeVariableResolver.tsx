/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

import {THEME_COLOR_VARIABLES, THEME_FONT_VARIABLES, isColorVariable} from '@app/utils/ThemeVariableUtils';

const THEME_VARIABLE_SET = new Set([...THEME_COLOR_VARIABLES, ...THEME_FONT_VARIABLES]);
const VAR_PATTERN = /var\(\s*(--[a-zA-Z0-9_-]+)/g;
const CACHE_TTL_MS = 5000;

interface SelectorEntry {
	selector: string;
	variables: ReadonlyArray<string>;
}

export interface HoveredInfo {
	elementInfo: string;
	colors: ReadonlyArray<string>;
	other: ReadonlyArray<string>;
}

let cachedEntries: ReadonlyArray<SelectorEntry> | null = null;
let cacheTimestamp = 0;

function extractVarEntries(rules: CSSRuleList): Array<SelectorEntry> {
	const entries: Array<SelectorEntry> = [];
	for (let j = 0; j < rules.length; j++) {
		const rule = rules[j]!;
		if (rule instanceof CSSStyleRule) {
			const cssText = rule.style.cssText;
			if (!cssText.includes('var(')) continue;
			const variables: Array<string> = [];
			let match: RegExpExecArray | null;
			VAR_PATTERN.lastIndex = 0;
			while ((match = VAR_PATTERN.exec(cssText)) !== null) {
				const varName = match[1] as string;
				if (THEME_VARIABLE_SET.has(varName) && !variables.includes(varName)) {
					variables.push(varName);
				}
			}
			if (variables.length > 0) {
				entries.push({selector: rule.selectorText, variables});
			}
		} else if ((rule as CSSGroupingRule).cssRules) {
			entries.push(...extractVarEntries((rule as CSSGroupingRule).cssRules));
		}
	}
	return entries;
}

function scanStyleSheets(): ReadonlyArray<SelectorEntry> {
	const now = Date.now();
	if (cachedEntries && now - cacheTimestamp < CACHE_TTL_MS) {
		return cachedEntries;
	}

	const entries: Array<SelectorEntry> = [];

	for (let i = 0; i < document.styleSheets.length; i++) {
		const sheet = document.styleSheets[i]!;
		let rules: CSSRuleList;
		try {
			rules = sheet.cssRules;
		} catch {
			continue;
		}
		if (!rules) continue;
		entries.push(...extractVarEntries(rules));
	}

	cachedEntries = entries;
	cacheTimestamp = now;
	return entries;
}

export function invalidateCache(): void {
	cachedEntries = null;
	cacheTimestamp = 0;
}

export function getThemeVariablesForElement(el: Element): HoveredInfo {
	const entries = scanStyleSheets();
	const found = new Set<string>();

	let current: Element | null = el;
	let depth = 0;
	const MAX_DEPTH = 15;

	while (current && current !== document.documentElement && current !== document.body && depth < MAX_DEPTH) {
		for (const entry of entries) {
			const selectors = entry.selector.split(',');
			for (const rawSelector of selectors) {
				const selector = rawSelector.trim();
				if (!selector || selector.includes('::')) continue;
				try {
					if (current.matches(selector)) {
						for (const v of entry.variables) {
							found.add(v);
						}
					}
				} catch {
					// Invalid selector, skip
				}
			}
		}
		current = current.parentElement;
		depth++;
	}

	const all = Array.from(found);
	const colors: Array<string> = [];
	const other: Array<string> = [];
	for (const v of all) {
		if (isColorVariable(v)) {
			colors.push(v);
		} else {
			other.push(v);
		}
	}

	let info = el.tagName.toLowerCase();
	if (el.id) {
		info += `#${el.id}`;
	} else if (typeof el.className === 'string' && el.className.trim()) {
		const raw = el.className.trim().split(/\s+/)[0]!;
		const m = raw.match(/^(\w+)\.module__(\w+)___\w+$/);
		info += '.' + (m ? `${m[1]}.${m[2]}` : raw.length > 30 ? raw.substring(0, 30) + '\u2026' : raw);
	}

	return {elementInfo: info, colors, other};
}

export function getElementsUsingVariable(variable: string): ReadonlyArray<Element> {
	const entries = scanStyleSheets();
	const matchingSelectors: Array<string> = [];

	for (const entry of entries) {
		if (entry.variables.includes(variable)) {
			const selectors = entry.selector.split(',');
			for (const rawSelector of selectors) {
				const selector = rawSelector.trim();
				if (selector && !selector.includes('::')) {
					matchingSelectors.push(selector);
				}
			}
		}
	}

	if (matchingSelectors.length === 0) return [];

	const combined = matchingSelectors.join(', ');
	try {
		return Array.from(document.querySelectorAll(combined));
	} catch {
		return [];
	}
}
