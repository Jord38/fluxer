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

import AppStorage from '@app/lib/AppStorage';
import {makeAutoObservable, runInAction} from 'mobx';

const POSITION_STORAGE_KEY = 'theme_inspector_position';

interface Position {
	x: number;
	y: number;
}

class ThemeInspectorStore {
	isOpen = false;
	selectorModeActive = false;
	selectedVariable: string | null = null;
	hoveredVariables: ReadonlyArray<string> = [];
	highlightedVariable: string | null = null;
	position: Position = {x: 20, y: 20};

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		const stored = AppStorage.getJSON<Position>(POSITION_STORAGE_KEY);
		if (stored && typeof stored.x === 'number' && typeof stored.y === 'number') {
			this.position = stored;
		}
	}

	toggle(): void {
		if (this.isOpen) {
			this.close();
		} else {
			this.open();
		}
	}

	open(): void {
		runInAction(() => {
			this.isOpen = true;
		});
	}

	close(): void {
		runInAction(() => {
			this.isOpen = false;
			this.selectorModeActive = false;
			this.selectedVariable = null;
			this.hoveredVariables = [];
			this.highlightedVariable = null;
		});
	}

	toggleSelectorMode(): void {
		runInAction(() => {
			this.selectorModeActive = !this.selectorModeActive;
			if (!this.selectorModeActive) {
				this.hoveredVariables = [];
			}
		});
	}

	setHoveredVariables(variables: ReadonlyArray<string>): void {
		runInAction(() => {
			this.hoveredVariables = variables;
		});
	}

	pinVariables(variables: ReadonlyArray<string>): void {
		runInAction(() => {
			this.selectorModeActive = false;
			this.hoveredVariables = variables;
			this.selectedVariable = null;
		});
	}

	selectVariable(variable: string | null): void {
		runInAction(() => {
			this.selectedVariable = variable;
			this.selectorModeActive = false;
		});
	}

	setHighlightedVariable(variable: string | null): void {
		runInAction(() => {
			this.highlightedVariable = variable;
		});
	}

	clearSelection(): void {
		runInAction(() => {
			this.selectedVariable = null;
			this.highlightedVariable = null;
		});
	}

	setPosition(pos: Position): void {
		runInAction(() => {
			this.position = pos;
		});
		AppStorage.setJSON(POSITION_STORAGE_KEY, pos);
	}
}

export default new ThemeInspectorStore();
