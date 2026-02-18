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

export const THEME_COLOR_VARIABLES: ReadonlyArray<string> = [
	'--background-primary',
	'--background-secondary',
	'--background-secondary-alt',
	'--background-tertiary',
	'--background-textarea',
	'--background-header-primary',
	'--background-header-primary-hover',
	'--background-header-secondary',
	'--background-modifier-hover',
	'--guild_list-foreground',
	'--background-modifier-selected',
	'--background-modifier-accent',
	'--background-modifier-accent-focus',
	'--brand-primary',
	'--brand-secondary',
	'--brand-primary-light',
	'--brand-primary-fill',
	'--status-online',
	'--status-idle',
	'--status-dnd',
	'--status-offline',
	'--status-danger',
	'--text-primary',
	'--text-secondary',
	'--text-tertiary',
	'--text-primary-muted',
	'--text-chat',
	'--text-chat-muted',
	'--text-link',
	'--text-on-brand-primary',
	'--text-tertiary-muted',
	'--text-tertiary-secondary',
	'--border-color',
	'--border-color-hover',
	'--border-color-focus',
	'--accent-primary',
	'--accent-success',
	'--accent-warning',
	'--accent-danger',
	'--accent-info',
	'--accent-purple',
	'--alert-note-color',
	'--alert-tip-color',
	'--alert-important-color',
	'--alert-warning-color',
	'--alert-caution-color',
	'--markup-mention-text',
	'--markup-mention-fill',
	'--markup-interactive-hover-text',
	'--markup-interactive-hover-fill',
	'--button-primary-fill',
	'--button-primary-active-fill',
	'--button-primary-text',
	'--button-secondary-fill',
	'--button-secondary-active-fill',
	'--button-secondary-text',
	'--button-secondary-active-text',
	'--button-danger-fill',
	'--button-danger-active-fill',
	'--button-danger-text',
	'--button-danger-outline-border',
	'--button-danger-outline-text',
	'--button-danger-outline-active-fill',
	'--button-danger-outline-active-border',
	'--button-ghost-text',
	'--button-inverted-fill',
	'--button-inverted-text',
	'--button-outline-border',
	'--button-outline-text',
	'--button-outline-active-fill',
	'--button-outline-active-border',
	'--bg-primary',
	'--bg-secondary',
	'--bg-tertiary',
	'--bg-hover',
	'--bg-active',
	'--bg-code',
	'--bg-code-block',
	'--bg-blockquote',
	'--bg-table-header',
	'--bg-table-row-odd',
	'--bg-table-row-even',
];

export const THEME_FONT_VARIABLES: ReadonlyArray<string> = ['--font-sans', '--font-mono'];

export function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractThemeVariableOverrides(css: string): Record<string, string> {
	const overrides: Record<string, string> = {};
	const variablePattern = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
	let match: RegExpExecArray | null;

	while ((match = variablePattern.exec(css)) !== null) {
		const variableName = `--${match[1] as string}`;
		const value = match[2] as string;
		overrides[variableName] = value.trim();
	}

	return overrides;
}

export function updateCssForVariable(css: string, variableName: string, newValue: string | null): string {
	const variableNamePattern = escapeRegExp(variableName);
	const propertyPattern = new RegExp(`(--${variableNamePattern.replace(/^--/, '')}\\s*:[^;]*;)`);

	if (newValue === null) {
		return css.replace(propertyPattern, '');
	}

	if (propertyPattern.test(css)) {
		return css.replace(propertyPattern, `${variableName}: ${newValue};`);
	}

	const trimmedCss = css.trim();
	const prefix = trimmedCss.length > 0 && !trimmedCss.endsWith('\n') ? '\n' : '';
	return `${trimmedCss}${prefix}:root { ${variableName}: ${newValue}; }\n`;
}

export function clampByte(value: number): number {
	return Math.max(0, Math.min(255, Math.round(value)));
}

export function numberToHex(value: number): string {
	return `#${(value >>> 0).toString(16).padStart(6, '0').slice(-6)}`.toUpperCase();
}

export function cssColorStringToNumber(color: string): number | null {
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');

	if (!context) return null;

	try {
		context.fillStyle = '#000';
		context.fillStyle = color;
		const parsed = String(context.fillStyle);

		const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(parsed);
		if (match) {
			const red = parseInt(match[1] ?? '0', 10);
			const green = parseInt(match[2] ?? '0', 10);
			const blue = parseInt(match[3] ?? '0', 10);
			const hex = `#${clampByte(red).toString(16).padStart(2, '0')}${clampByte(green)
				.toString(16)
				.padStart(2, '0')}${clampByte(blue).toString(16).padStart(2, '0')}`.toUpperCase();

			return Number.parseInt(hex.slice(1), 16) >>> 0;
		}

		if (/^#[0-9A-Fa-f]{6}$/.test(parsed)) {
			return Number.parseInt(parsed.slice(1), 16) >>> 0;
		}
	} catch {
		return null;
	}

	return null;
}
