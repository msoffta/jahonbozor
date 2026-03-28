import * as React from "react";

/** Data attribute names used to locate cells in the DOM */
const ROW_ATTR = "data-row-index";
const COL_ATTR = "data-column-id";

interface UseCellNavigationOptions {
    enabled: boolean;
    containerRef: React.RefObject<HTMLElement | null>;
}

/**
 * Spreadsheet-style keyboard navigation for DataTable.
 *
 * Attaches a keydown listener to `containerRef` and handles:
 * - ArrowUp/Down — move focus to same column in adjacent row
 * - ArrowLeft/Right — move to adjacent column when cursor is at start/end
 * - Tab/Shift+Tab — next/prev editable cell, wrapping rows
 * - Enter — move focus down one row (spreadsheet convention)
 * - Escape — blur current cell
 *
 * Cells must have `data-row-index` and `data-column-id` attributes on the `<td>`.
 */
export function useCellNavigation({ enabled, containerRef }: UseCellNavigationOptions) {
    React.useEffect(() => {
        if (!enabled) return;
        const container = containerRef.current;
        if (!container) return;

        function getCell(rowIndex: number, columnId: string): HTMLTableCellElement | null {
            return container!.querySelector(
                `td[${ROW_ATTR}="${rowIndex}"][${COL_ATTR}="${columnId}"]`,
            );
        }

        function getAllCells(): HTMLTableCellElement[] {
            return Array.from(
                container!.querySelectorAll<HTMLTableCellElement>(`td[${ROW_ATTR}][${COL_ATTR}]`),
            );
        }

        function getCellCoords(td: HTMLTableCellElement): { row: number; col: string } | null {
            const row = td.getAttribute(ROW_ATTR);
            const col = td.getAttribute(COL_ATTR);
            if (row == null || col == null) return null;
            return { row: Number(row), col };
        }

        function findInputIn(td: HTMLTableCellElement): HTMLInputElement | null {
            return td.querySelector<HTMLInputElement>('input, [role="combobox"]');
        }

        function focusCell(td: HTMLTableCellElement) {
            const input = findInputIn(td);
            if (input) {
                input.focus();
                input.select();
            }
        }

        /** Get unique sorted row indices from all cells */
        function getRowIndices(cells: HTMLTableCellElement[]): number[] {
            const set = new Set<number>();
            for (const c of cells) {
                const r = c.getAttribute(ROW_ATTR);
                if (r != null) set.add(Number(r));
            }
            return Array.from(set).sort((a, b) => a - b);
        }

        /** Get unique column IDs in DOM order from the first row */
        function getColumnIds(cells: HTMLTableCellElement[]): string[] {
            const seen = new Set<string>();
            const result: string[] = [];
            for (const c of cells) {
                const col = c.getAttribute(COL_ATTR);
                if (col && !seen.has(col)) {
                    seen.add(col);
                    result.push(col);
                }
            }
            return result;
        }

        function isAtInputStart(input: HTMLInputElement): boolean {
            return input.selectionStart === 0 && input.selectionEnd === 0;
        }

        function isAtInputEnd(input: HTMLInputElement): boolean {
            const len = input.value.length;
            return input.selectionStart === len && input.selectionEnd === len;
        }

        /** Check if a combobox dropdown is currently open */
        function isComboboxOpen(el: HTMLElement): boolean {
            if (
                el.getAttribute("role") === "combobox" &&
                el.getAttribute("aria-expanded") === "true"
            )
                return true;
            const combobox = el.closest('[role="combobox"]');
            return combobox?.getAttribute("aria-expanded") === "true";
        }

        function handleKeyDown(e: KeyboardEvent) {
            const target = e.target as HTMLElement;
            const td = target.closest<HTMLTableCellElement>(`td[${ROW_ATTR}]`);
            if (!td) return;

            const coords = getCellCoords(td);
            if (!coords) return;

            const cells = getAllCells();
            const rowIndices = getRowIndices(cells);
            const columnIds = getColumnIds(cells);
            const rowPos = rowIndices.indexOf(coords.row);
            const colPos = columnIds.indexOf(coords.col);

            const input = target.tagName === "INPUT" ? (target as HTMLInputElement) : null;

            // Don't intercept arrow keys when combobox dropdown is open
            if ((e.key === "ArrowUp" || e.key === "ArrowDown") && isComboboxOpen(target)) return;

            switch (e.key) {
                case "ArrowUp": {
                    e.preventDefault();
                    if (rowPos > 0) {
                        const targetTd = getCell(rowIndices[rowPos - 1], coords.col);
                        if (targetTd) focusCell(targetTd);
                    }
                    break;
                }

                case "ArrowDown": {
                    e.preventDefault();
                    if (rowPos < rowIndices.length - 1) {
                        const targetTd = getCell(rowIndices[rowPos + 1], coords.col);
                        if (targetTd) focusCell(targetTd);
                    }
                    break;
                }

                case "ArrowLeft": {
                    // Only navigate if cursor is at the start of input
                    if (input && !isAtInputStart(input)) return;
                    e.preventDefault();
                    // Find prev column that has an input
                    for (let i = colPos - 1; i >= 0; i--) {
                        const targetTd = getCell(coords.row, columnIds[i]);
                        if (targetTd && findInputIn(targetTd)) {
                            focusCell(targetTd);
                            break;
                        }
                    }
                    break;
                }

                case "ArrowRight": {
                    // Only navigate if cursor is at the end of input
                    if (input && !isAtInputEnd(input)) return;
                    e.preventDefault();
                    // Find next column that has an input
                    for (let i = colPos + 1; i < columnIds.length; i++) {
                        const targetTd = getCell(coords.row, columnIds[i]);
                        if (targetTd && findInputIn(targetTd)) {
                            focusCell(targetTd);
                            break;
                        }
                    }
                    break;
                }

                case "Tab": {
                    e.preventDefault();
                    const direction = e.shiftKey ? -1 : 1;

                    // Build ordered list of editable cells
                    const editableCells: HTMLTableCellElement[] = [];
                    for (const ri of rowIndices) {
                        for (const ci of columnIds) {
                            const c = getCell(ri, ci);
                            if (c && findInputIn(c)) editableCells.push(c);
                        }
                    }

                    const currentIdx = editableCells.indexOf(td);
                    if (currentIdx === -1) break;

                    const nextIdx = currentIdx + direction;
                    if (nextIdx >= 0 && nextIdx < editableCells.length) {
                        focusCell(editableCells[nextIdx]);
                    }
                    break;
                }

                case "Enter": {
                    // Don't interfere if inside a combobox dropdown
                    if (isComboboxOpen(target)) return;
                    e.preventDefault();
                    // Save current (blur triggers save), then move to next row's first editable
                    input?.blur();

                    if (rowPos < rowIndices.length - 1) {
                        const nextRow = rowIndices[rowPos + 1];
                        for (const ci of columnIds) {
                            const c = getCell(nextRow, ci);
                            if (c && findInputIn(c)) {
                                requestAnimationFrame(() => focusCell(c));
                                break;
                            }
                        }
                    }
                    break;
                }

                case "Escape": {
                    // Let the event bubble to cell's React onKeyDown → handleCancel()
                    return;
                }
            }
        }

        container.addEventListener("keydown", handleKeyDown, true);
        return () => container.removeEventListener("keydown", handleKeyDown, true);
    }, [enabled, containerRef]);
}
