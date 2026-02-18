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

import {THEME_COLOR_VARIABLES, THEME_FONT_VARIABLES} from '@app/utils/ThemeVariableUtils';

const THEME_VARIABLE_SET = new Set([...THEME_COLOR_VARIABLES, ...THEME_FONT_VARIABLES]);
const VAR_PATTERN = /var\(\s*(--[a-zA-Z0-9_-]+)/g;
const CACHE_TTL_MS = 5000;

interface SelectorEntry {
	selector: string;
	variables: ReadonlyArray<string>;
}

let cachedEntries: ReadonlyArray<SelectorEntry> | null = null;
let cacheTimestamp = 0;

function scanStyleSheets(): ReadonlyArray<SelectorEntry> {
	const now = Date.now();
	if (cachedEntries && now - cacheTimestamp < CACHE_TTL_MS) {
		return cachedEntries;
	}

	const entries: Array<SelectorEntry> = [];

	for (let i = 0; i < document.styleSheets.length; i++) {
		const sheet = document.styleSheets[i];
		let rules: CSSRuleList;
		try {
			rules = sheet.cssRules;
		} catch {
			continue;
		}

		for (let j = 0; j < rules.length; j++) {
			const rule = rules[j];
			if (!(rule instanceof CSSStyleRule)) continue;

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
		}
	}

	cachedEntries = entries;
	cacheTimestamp = now;
	return entries;
}

export function invalidateCache(): void {
	cachedEntries = null;
	cacheTimestamp = 0;
}

export function getThemeVariablesForElement(el: Element): ReadonlyArray<string> {
	const entries = scanStyleSheets();
	const found = new Set<string>();

	// Walk up the DOM tree so we also find variables from ancestor rules
	// (e.g. a parent div sets background-color: var(--background-primary))
	// Stop before <html> and <body> to avoid picking up root-level definitions
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

	return Array.from(found);
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
