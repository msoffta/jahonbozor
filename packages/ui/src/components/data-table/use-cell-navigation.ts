import * as React from "react";

/** Data attribute names used to locate cells in the DOM */
const ROW_ATTR = "data-row-index";
const COL_ATTR = "data-column-id";

interface UseCellNavigationOptions {
    enabled: boolean;
    containerRef: React.RefObject<HTMLElement | null>;
    /** Return entity ID for Ctrl+Z undo */
    onRowDelete?: (rowIndex: number) => unknown;
    /** Called on Ctrl+Z to restore the last deleted row */
    onRowRestore?: (id: unknown) => void;
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
export function useCellNavigation({
    enabled,
    containerRef,
    onRowDelete,
    onRowRestore,
}: UseCellNavigationOptions) {
    // Track last deleted entity ID for Ctrl+Z undo (persists across effect re-runs)
    const lastDeletedIdRef = React.useRef<unknown>(null);
    // Stable refs for callbacks to avoid effect re-runs on inline functions
    const onRowDeleteRef = React.useRef(onRowDelete);
    const onRowRestoreRef = React.useRef(onRowRestore);
    React.useEffect(() => {
        onRowDeleteRef.current = onRowDelete;
        onRowRestoreRef.current = onRowRestore;
    });

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

        function findInputIn(td: HTMLTableCellElement): HTMLElement | null {
            // Match either text-like inputs or combobox triggers. The latter
            // may be a <button> (Radix Select) or <input> (DataTableCombobox).
            return td.querySelector<HTMLElement>('input, [role="combobox"]');
        }

        /** Move cursor to cell. editMode=true focuses the input for editing. */
        function focusCell(td: HTMLTableCellElement, editMode = false) {
            if (editMode) {
                const input = findInputIn(td);
                if (input) {
                    input.focus();
                    // Only HTMLInputElement supports `.select()`; button-based
                    // combobox triggers (Radix Select) don't.
                    if (input instanceof HTMLInputElement) {
                        input.select();
                    }
                    return;
                }
            }
            // Cursor mode: focus <td> itself → outline appears, no input activation
            td.focus();
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

        /**
         * Focus the next editable cell in horizontal order, skipping cells
         * marked with `data-skip-on-enter`, wrapping to the next row.
         *
         * Focuses directly (no rAF) so the browser's implicit blur on the
         * previous input carries the correct `relatedTarget`, which lets
         * row-level blur handlers detect the focus moved to another row
         * and trigger save.
         *
         * Returns true if focus moved, false if there's no next cell.
         */
        function advanceToNextEnterCell(currentRow: number, currentCol: string): boolean {
            const freshCells = getAllCells();
            const freshRowIndices = getRowIndices(freshCells);
            const freshColumnIds = getColumnIds(freshCells);

            const enterCells: { row: number; col: string; td: HTMLTableCellElement }[] = [];
            for (const ri of freshRowIndices) {
                for (const ci of freshColumnIds) {
                    const c = getCell(ri, ci);
                    if (c && findInputIn(c) && !c.hasAttribute("data-skip-on-enter")) {
                        enterCells.push({ row: ri, col: ci, td: c });
                    }
                }
            }

            const currentIdx = enterCells.findIndex(
                (c) => c.row === currentRow && c.col === currentCol,
            );
            if (currentIdx !== -1 && currentIdx + 1 < enterCells.length) {
                focusCell(enterCells[currentIdx + 1].td, true);
                return true;
            }
            // Current cell has skipOnEnter — find next enter-flow cell after this position
            if (currentIdx === -1) {
                const colPos = freshColumnIds.indexOf(currentCol);
                const next = enterCells.find(
                    (c) =>
                        c.row > currentRow ||
                        (c.row === currentRow && freshColumnIds.indexOf(c.col) > colPos),
                );
                if (next) {
                    focusCell(next.td, true);
                    return true;
                }
            }
            return false;
        }

        /** Handle combobox-select custom event — auto-advance after selection */
        function handleComboboxSelect(e: Event) {
            const target = e.target as HTMLElement;
            const td = target.closest<HTMLTableCellElement>(`td[${ROW_ATTR}]`);
            if (!td) return;
            const cellCoords = getCellCoords(td);
            if (!cellCoords) return;
            advanceToNextEnterCell(cellCoords.row, cellCoords.col);
        }

        function handleKeyDown(e: KeyboardEvent) {
            // Ctrl+Z — undo last delete (e.code is layout-independent)
            if (
                e.code === "KeyZ" &&
                (e.ctrlKey || e.metaKey) &&
                !e.shiftKey &&
                lastDeletedIdRef.current != null &&
                onRowRestoreRef.current
            ) {
                e.preventDefault();
                onRowRestoreRef.current(lastDeletedIdRef.current);
                lastDeletedIdRef.current = null;
                return;
            }

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
                    if (e.shiftKey) {
                        // Shift+Arrow → extend drag-sum selection
                        container!.dispatchEvent(
                            new CustomEvent("datatable:shift-select", {
                                detail: {
                                    row: rowPos > 0 ? rowIndices[rowPos - 1] : coords.row,
                                    col: coords.col,
                                },
                            }),
                        );
                    } else {
                        container!.dispatchEvent(new CustomEvent("datatable:navigate"));
                    }
                    if (rowPos > 0) {
                        const targetTd = getCell(rowIndices[rowPos - 1], coords.col);
                        if (targetTd) focusCell(targetTd);
                    }
                    break;
                }

                case "ArrowDown": {
                    e.preventDefault();
                    if (e.shiftKey) {
                        container!.dispatchEvent(
                            new CustomEvent("datatable:shift-select", {
                                detail: {
                                    row:
                                        rowPos < rowIndices.length - 1
                                            ? rowIndices[rowPos + 1]
                                            : coords.row,
                                    col: coords.col,
                                },
                            }),
                        );
                    } else {
                        container!.dispatchEvent(new CustomEvent("datatable:navigate"));
                    }
                    if (rowPos < rowIndices.length - 1) {
                        const targetTd = getCell(rowIndices[rowPos + 1], coords.col);
                        if (targetTd) focusCell(targetTd);
                    }
                    break;
                }

                case "ArrowLeft": {
                    if (input && !isAtInputStart(input)) return;
                    e.preventDefault();
                    container!.dispatchEvent(new CustomEvent("datatable:navigate"));
                    for (let i = colPos - 1; i >= 0; i--) {
                        const targetTd = getCell(coords.row, columnIds[i]);
                        if (targetTd) {
                            focusCell(targetTd);
                            break;
                        }
                    }
                    break;
                }

                case "ArrowRight": {
                    if (input && !isAtInputEnd(input)) return;
                    e.preventDefault();
                    container!.dispatchEvent(new CustomEvent("datatable:navigate"));
                    for (let i = colPos + 1; i < columnIds.length; i++) {
                        const targetTd = getCell(coords.row, columnIds[i]);
                        if (targetTd) {
                            focusCell(targetTd);
                            break;
                        }
                    }
                    break;
                }

                case "Tab": {
                    e.preventDefault();
                    container!.dispatchEvent(new CustomEvent("datatable:navigate"));

                    // If combobox dropdown is open, select the highlighted option first
                    if (target.getAttribute("role") === "combobox") {
                        const listboxId = target.getAttribute("aria-controls");
                        if (listboxId) {
                            const selected = document.querySelector(
                                `#${CSS.escape(listboxId)} [aria-selected="true"]`,
                            );
                            if (selected) {
                                (selected as HTMLElement).dispatchEvent(
                                    new MouseEvent("mousedown", { bubbles: true }),
                                );
                            }
                        }
                    }

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
                        focusCell(editableCells[nextIdx], true); // Tab enters edit mode
                    }
                    break;
                }

                case "Enter": {
                    if (isComboboxOpen(target)) return;
                    e.preventDefault();

                    if (input) {
                        // Focus next cell directly — browser auto-blurs the current
                        // input with relatedTarget pointing to the new cell, which
                        // lets row-level blur handlers detect cross-row navigation
                        // and trigger save.
                        if (!advanceToNextEnterCell(coords.row, coords.col)) {
                            // No next enter-cell — ask the table to append a new
                            // pending row and focus its first enter-cell. Table
                            // owner listens to this event; if it can't append
                            // (e.g. maxCount reached) the input stays focused.
                            container!.dispatchEvent(
                                new CustomEvent("datatable:request-append-row", {
                                    detail: { fromRow: coords.row, fromCol: coords.col },
                                }),
                            );
                        }
                        e.stopImmediatePropagation();
                    } else {
                        // Cursor on <td>. Behavior depends on what the cell hosts:
                        //   • Radix Select trigger (<button role="combobox">) —
                        //     click it so its dropdown opens (it has no `.value`
                        //     property, so the advance-heuristic below doesn't apply).
                        //   • Our DataTableCombobox (<input role="combobox">) that
                        //     already has a non-empty value — advance to the next
                        //     enter-cell (spreadsheet convention).
                        //   • Any other editable cell — enter edit mode.
                        const cellCombobox = td.querySelector<HTMLElement>('[role="combobox"]');
                        const comboboxEl =
                            target.getAttribute("role") === "combobox" ? target : cellCombobox;

                        if (comboboxEl instanceof HTMLButtonElement) {
                            // Radix Select trigger. Figure out whether the cell
                            // already has a value: Radix marks the inner
                            // SelectValue element with `data-placeholder` when
                            // no value is set.
                            const isEmpty =
                                comboboxEl.querySelector("[data-placeholder]") !== null ||
                                comboboxEl.hasAttribute("data-placeholder");

                            if (isEmpty) {
                                // No value yet — open the dropdown. Radix
                                // Select's onClick handler calls handleOpen()
                                // when pointerType !== "mouse" (undefined when
                                // no pointerdown preceded), so a bare .click()
                                // reliably opens the menu without triggering
                                // our own capture-phase keydown listener.
                                comboboxEl.focus();
                                comboboxEl.click();
                            } else {
                                // Value already set — behave like a regular cell:
                                // advance to the next enter-flow cell (spreadsheet
                                // convention).
                                if (!advanceToNextEnterCell(coords.row, coords.col)) {
                                    container!.dispatchEvent(
                                        new CustomEvent("datatable:request-append-row", {
                                            detail: { fromRow: coords.row, fromCol: coords.col },
                                        }),
                                    );
                                }
                            }
                            e.stopImmediatePropagation();
                            break;
                        }

                        const closedInputComboboxWithValue =
                            comboboxEl instanceof HTMLInputElement &&
                            comboboxEl.getAttribute("aria-expanded") !== "true" &&
                            comboboxEl.value !== "";
                        if (closedInputComboboxWithValue) {
                            if (!advanceToNextEnterCell(coords.row, coords.col)) {
                                container!.dispatchEvent(
                                    new CustomEvent("datatable:request-append-row", {
                                        detail: { fromRow: coords.row, fromCol: coords.col },
                                    }),
                                );
                            }
                        } else {
                            // Cursor on <td> → enter edit mode if cell has input
                            focusCell(td, true);
                        }
                        e.stopImmediatePropagation();
                    }
                    break;
                }

                case "Escape": {
                    if (input) {
                        // Exit edit mode → return focus to <td> (cursor mode)
                        // Let the event bubble first so cell's handleCancel() reverts value
                        requestAnimationFrame(() => td.focus());
                    }
                    return;
                }

                case "Delete": {
                    if (onRowDeleteRef.current) {
                        e.preventDefault();
                        lastDeletedIdRef.current = onRowDeleteRef.current(coords.row);
                        // Move cursor to next row (or first new/empty row below)
                        if (rowPos < rowIndices.length - 1) {
                            const target = getCell(rowIndices[rowPos + 1], coords.col);
                            if (target) target.focus();
                        }
                    }
                    break;
                }

                case "Backspace": {
                    if (!input) {
                        // Cursor mode → clear cell value and enter edit mode.
                        // Only meaningful for text-like inputs; Radix Select
                        // button triggers manage value via React state.
                        const cellInput = findInputIn(td);
                        if (cellInput instanceof HTMLInputElement) {
                            e.preventDefault();
                            cellInput.value = "";
                            cellInput.dispatchEvent(new Event("input", { bubbles: true }));
                            cellInput.focus();
                        } else if (cellInput) {
                            // Button combobox — just focus; let component handle it.
                            e.preventDefault();
                            cellInput.focus();
                        }
                    }
                    break;
                }

                default: {
                    // Printable character on <td> → enter edit mode, clear value, type
                    if (!input && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        const cellInput = findInputIn(td);
                        if (cellInput instanceof HTMLInputElement) {
                            cellInput.value = "";
                            cellInput.dispatchEvent(new Event("input", { bubbles: true }));
                            cellInput.focus();
                            // Don't preventDefault — let the character be typed into the input
                        } else if (cellInput) {
                            // Button combobox (Radix Select) — just focus so
                            // keyboard interaction (letters/space) can open it.
                            cellInput.focus();
                        }
                    }
                    break;
                }
            }
        }

        container.addEventListener("keydown", handleKeyDown, true);
        container.addEventListener("combobox-select", handleComboboxSelect);
        return () => {
            container.removeEventListener("keydown", handleKeyDown, true);
            container.removeEventListener("combobox-select", handleComboboxSelect);
        };
    }, [enabled, containerRef]);
}
