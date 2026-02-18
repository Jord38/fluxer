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

import * as AccessibilityActionCreators from '@app/actions/AccessibilityActionCreators';
import {ColorPickerField} from '@app/components/form/ColorPickerField';
import styles from '@app/components/theme_inspector/ThemeInspectorToolbar.module.css';
import {Button} from '@app/components/uikit/button/Button';
import type {HoveredInfo} from '@app/lib/ThemeVariableResolver';
import {getElementsUsingVariable, getThemeVariablesForElement} from '@app/lib/ThemeVariableResolver';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import ThemeInspectorStore from '@app/stores/ThemeInspectorStore';
import {cssColorStringToNumber, numberToHex, updateCssForVariable} from '@app/utils/ThemeVariableUtils';
import {CrosshairSimpleIcon, HighlighterCircleIcon, PaletteIcon, XIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {motion, useDragControls, useMotionValue} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useHotkeys} from 'react-hotkeys-hook';

const HIGHLIGHT_ATTR = 'data-theme-inspector-highlight';
const HIGHLIGHT_STYLE_ID = 'theme-inspector-highlight-style';

function ensureHighlightStyle(): void {
	if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
	const style = document.createElement('style');
	style.id = HIGHLIGHT_STYLE_ID;
	style.textContent = `[${HIGHLIGHT_ATTR}] { outline: 2px solid #7c3aed !important; outline-offset: 2px; box-shadow: inset 0 0 0 9999px rgba(124, 58, 237, 0.08), 0 0 0 4px rgba(124, 58, 237, 0.15) !important; }`;
	document.head.appendChild(style);
}

function removeHighlightStyle(): void {
	const el = document.getElementById(HIGHLIGHT_STYLE_ID);
	if (el) el.remove();
}

function clearAllHighlights(): void {
	const highlighted = document.querySelectorAll(`[${HIGHLIGHT_ATTR}]`);
	for (const el of highlighted) {
		el.removeAttribute(HIGHLIGHT_ATTR);
	}
}

function highlightElementsForVariable(variable: string): void {
	clearAllHighlights();
	ensureHighlightStyle();
	const elements = getElementsUsingVariable(variable);
	for (const el of elements) {
		el.setAttribute(HIGHLIGHT_ATTR, 'true');
	}
}

function removeHoverOverlay(): void {
	// Handled by React state now
}

function getResolvedColor(variable: string): string {
	return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

interface HoverOverlayState {
	top: number;
	left: number;
	width: number;
	height: number;
	label: string;
	labelTop: number;
	labelLeft: number;
}

const HoverOverlay: React.FC<{overlay: HoverOverlayState}> = ({overlay}) =>
	createPortal(
		<>
			<div
				className={styles.hoverOverlay}
				style={{top: overlay.top, left: overlay.left, width: overlay.width, height: overlay.height}}
			/>
			<div className={styles.hoverLabel} style={{top: overlay.labelTop, left: overlay.labelLeft}}>
				{overlay.label}
			</div>
		</>,
		document.body,
	);

const VariableList: React.FC<{
	variables: ReadonlyArray<string>;
	onSelect: (variable: string) => void;
	onHover: (variable: string | null) => void;
}> = ({variables, onSelect, onHover}) => (
	<div className={styles.variableList}>
		{variables.map((v) => (
			<button
				key={v}
				type="button"
				className={styles.variableItem}
				onClick={() => onSelect(v)}
				onMouseEnter={() => onHover(v)}
				onMouseLeave={() => onHover(null)}
			>
				<div className={styles.swatch} style={{backgroundColor: `var(${v})`}} />
				<span className={styles.variableName}>{v}</span>
			</button>
		))}
	</div>
);

const SelectedVariableEditor: React.FC<{variable: string}> = observer(({variable}) => {
	const customThemeCss = AccessibilityStore.customThemeCss ?? '';
	const resolvedColor = getResolvedColor(variable);
	const colorNumber = cssColorStringToNumber(resolvedColor) ?? 0;

	const handleChange = useCallback(
		(nextValue: number) => {
			const updatedCss =
				nextValue === 0
					? updateCssForVariable(customThemeCss, variable, null)
					: updateCssForVariable(customThemeCss, variable, numberToHex(nextValue));
			AccessibilityActionCreators.update({customThemeCss: updatedCss});
		},
		[customThemeCss, variable],
	);

	const handleHighlight = useCallback(() => {
		const current = ThemeInspectorStore.highlightedVariable;
		if (current === variable) {
			clearAllHighlights();
			ThemeInspectorStore.setHighlightedVariable(null);
		} else {
			highlightElementsForVariable(variable);
			ThemeInspectorStore.setHighlightedVariable(variable);
		}
	}, [variable]);

	const handleClear = useCallback(() => {
		clearAllHighlights();
		ThemeInspectorStore.clearSelection();
	}, []);

	return (
		<div className={styles.selectedSection}>
			<div className={styles.selectedHeader}>{variable}</div>
			<ColorPickerField label="" value={colorNumber} onChange={handleChange} hideHelperText />
			<div className={styles.actionButtons}>
				<Button
					variant="secondary"
					compact
					fitContent
					leftIcon={<HighlighterCircleIcon size={14} />}
					onClick={handleHighlight}
				>
					{ThemeInspectorStore.highlightedVariable === variable ? 'Clear highlight' : 'Highlight usage'}
				</Button>
				<Button variant="secondary" compact fitContent onClick={handleClear}>
					Clear selection
				</Button>
			</div>
		</div>
	);
});

function buildElementLabel(el: Element): string {
	let label = el.tagName.toLowerCase();
	if (el.id) {
		label += '#' + el.id;
	} else if (typeof el.className === 'string' && el.className.trim()) {
		const raw = el.className.trim().split(/\s+/)[0]!;
		const m = raw.match(/^(\w+)\.module__(\w+)___\w+$/);
		label += '.' + (m ? `${m[1]}.${m[2]}` : raw.length > 24 ? raw.substring(0, 24) + '\u2026' : raw);
	}
	return label;
}

const ThemeInspectorToolbarInner: React.FC = observer(() => {
	const toolbarRef = useRef<HTMLDivElement>(null);
	const selectorModeActive = ThemeInspectorStore.selectorModeActive;
	const selectedVariable = ThemeInspectorStore.selectedVariable;
	const hoveredInfo = ThemeInspectorStore.hoveredInfo;
	const hoveredInfoRef = useRef(hoveredInfo);
	hoveredInfoRef.current = hoveredInfo;

	const [hoverOverlay, setHoverOverlay] = useState<HoverOverlayState | null>(null);
	const lastHoverTargetRef = useRef<Element | null>(null);

	const x = useMotionValue(ThemeInspectorStore.position.x);
	const y = useMotionValue(ThemeInspectorStore.position.y);
	const dragControls = useDragControls();

	const handleDragEnd = useCallback(() => {
		ThemeInspectorStore.setPosition({x: x.get(), y: y.get()});
	}, [x, y]);

	const handleHeaderPointerDown = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (event.button !== 0) return;
			const target = event.target as HTMLElement;
			if (target.closest('button')) return;
			dragControls.start(event);
		},
		[dragControls],
	);

	const handleClose = useCallback(() => {
		clearAllHighlights();
		ThemeInspectorStore.close();
	}, []);

	const handleToggleSelector = useCallback(() => {
		if (selectorModeActive) {
			clearAllHighlights();
		}
		ThemeInspectorStore.toggleSelectorMode();
	}, [selectorModeActive]);

	const handleVariableSelect = useCallback((variable: string) => {
		ThemeInspectorStore.selectVariable(variable);
	}, []);

	const handleVariableHover = useCallback(
		(variable: string | null) => {
			if (variable) {
				highlightElementsForVariable(variable);
			} else if (!ThemeInspectorStore.highlightedVariable) {
				clearAllHighlights();
			}
		},
		[],
	);

	// Capture-phase document listeners for element selector mode
	useEffect(() => {
		if (!selectorModeActive) {
			setHoverOverlay(null);
			lastHoverTargetRef.current = null;
			return;
		}

		const handleMouseMove = (event: MouseEvent) => {
			const target = event.target as Element | null;
			if (!target || target.nodeType !== 1) return;
			if (toolbarRef.current?.contains(target)) return;
			if (target === lastHoverTargetRef.current) return;
			lastHoverTargetRef.current = target;

			const rect = target.getBoundingClientRect();
			const label = buildElementLabel(target);
			const labelTop = rect.top > 24 ? rect.top - 22 : rect.bottom + 2;
			setHoverOverlay({
				top: rect.top,
				left: rect.left,
				width: rect.width,
				height: rect.height,
				label: `${label}  ${Math.round(rect.width)}\u00d7${Math.round(rect.height)}`,
				labelTop,
				labelLeft: rect.left,
			});

			const info = getThemeVariablesForElement(target);
			ThemeInspectorStore.setHoveredInfo(info);
		};

		const handleClick = (event: MouseEvent) => {
			const target = event.target as Element | null;
			if (!target) return;
			if (toolbarRef.current?.contains(target)) return;
			event.preventDefault();
			event.stopPropagation();
			const current = hoveredInfoRef.current;
			if (!current) return;
			const all = [...current.colors, ...current.other];
			if (all.length === 1) {
				ThemeInspectorStore.selectVariable(all[0] as string);
			} else if (all.length > 0) {
				ThemeInspectorStore.pinHoveredInfo();
			}
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				ThemeInspectorStore.toggleSelectorMode();
			}
		};

		document.addEventListener('mousemove', handleMouseMove, true);
		document.addEventListener('click', handleClick, true);
		document.addEventListener('keydown', handleKeyDown, true);
		document.body.style.cursor = 'crosshair';

		return () => {
			document.removeEventListener('mousemove', handleMouseMove, true);
			document.removeEventListener('click', handleClick, true);
			document.removeEventListener('keydown', handleKeyDown, true);
			document.body.style.cursor = '';
			setHoverOverlay(null);
			lastHoverTargetRef.current = null;
		};
	}, [selectorModeActive]);

	useEffect(() => {
		return () => {
			clearAllHighlights();
			removeHighlightStyle();
			document.body.style.cursor = '';
		};
	}, []);

	const hasColors = hoveredInfo != null && hoveredInfo.colors.length > 0;
	const hasOther = hoveredInfo != null && hoveredInfo.other.length > 0;
	const hasAny = hasColors || hasOther;

	let bodyContent: React.ReactNode;

	if (selectedVariable) {
		bodyContent = <SelectedVariableEditor variable={selectedVariable} />;
	} else if (hoveredInfo && hasAny) {
		bodyContent = (
			<>
				<div className={styles.elementInfo}>{hoveredInfo.elementInfo}</div>
				{hasColors && (
					<>
						<div className={styles.sectionLabel}>Colors ({hoveredInfo.colors.length})</div>
						<VariableList
							variables={hoveredInfo.colors}
							onSelect={handleVariableSelect}
							onHover={handleVariableHover}
						/>
					</>
				)}
				{hasOther && (
					<details className={styles.inheritedSection}>
						<summary className={styles.sectionLabelToggle}>
							Layout &amp; other ({hoveredInfo.other.length})
						</summary>
						<VariableList
							variables={hoveredInfo.other}
							onSelect={handleVariableSelect}
							onHover={handleVariableHover}
						/>
					</details>
				)}
			</>
		);
	} else if (selectorModeActive) {
		bodyContent = <div className={styles.hint}>Hover over an element to see which theme variables style it.</div>;
	} else {
		bodyContent = (
			<div className={styles.hint}>
				Click the crosshair to activate element selector mode, or press Ctrl+Shift+T to toggle this toolbar.
			</div>
		);
	}

	return (
		<>
			{selectorModeActive && hoverOverlay && <HoverOverlay overlay={hoverOverlay} />}
			<motion.div
				ref={toolbarRef}
				className={styles.container}
				style={{x, y}}
				drag
				dragControls={dragControls}
				dragListener={false}
				dragMomentum={false}
				dragElastic={0}
				onDragEnd={handleDragEnd}
			>
				<div className={styles.header} onPointerDown={handleHeaderPointerDown}>
					<PaletteIcon weight="duotone" className={styles.headerIcon} />
					<span className={styles.headerTitle}>Theme Inspector</span>
					<button
						type="button"
						className={clsx(styles.headerButton, selectorModeActive && styles.headerButtonActive)}
						onClick={handleToggleSelector}
						aria-label="Toggle element selector"
					>
						<CrosshairSimpleIcon weight="bold" className={styles.headerButtonIcon} />
					</button>
					<button type="button" className={styles.headerButton} onClick={handleClose} aria-label="Close theme inspector">
						<XIcon weight="bold" className={styles.headerButtonIcon} />
					</button>
				</div>
				<div className={styles.body}>{bodyContent}</div>
			</motion.div>
		</>
	);
});

export const ThemeInspectorToolbar: React.FC = observer(() => {
	const isOpen = ThemeInspectorStore.isOpen;
	if (!isOpen) return null;
	return <ThemeInspectorToolbarInner />;
});

export const ThemeInspectorHotkeyListener: React.FC = () => {
	useHotkeys(
		'mod+shift+t',
		() => {
			ThemeInspectorStore.toggle();
		},
		{
			enableOnFormTags: true,
			enableOnContentEditable: true,
			preventDefault: true,
		},
	);
	return null;
};
