import * as React from "react";

import { flexRender } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2 } from "lucide-react";

import { cn } from "../../lib/utils";
import { Checkbox } from "../ui/checkbox";
import { TableBody, TableCell, TableRow } from "../ui/table";
import { DataTableCellInput, GHOST_INPUT_CLASS, toDisplayString } from "./data-table-cell-input";
import { DataTableEditableCell } from "./data-table-editable-cell";
import { DataTableScrollingContext, useIsScrolling } from "./use-is-scrolling";
import { useMultiRowState } from "./use-multi-row-state";

import type { NewRowState } from "./types";
import type { ColumnDef, Row, Table as TanStackTable } from "@tanstack/react-table";

/** Imperative API exposed by DataTableBody for parent-level access to
 *  multi-row state (e.g. flushing pending saves before unmount). */
export interface DataTableBodyApi {
    flushPendingRows: () => Promise<void>;
    appendRow: () => string | null;
}

const VIRTUAL_ROW_HEIGHT_PX = 36;
const VIRTUALIZER_OVERSCAN = 12;
/** How close to the end of new rows to trigger lazy loading (virtual mode) */
const LAZY_LOAD_THRESHOLD = 5;

const DRAG_SUM_HIGHLIGHT = "bg-drag-sum ring-1 ring-inset ring-drag-sum-border";

/** Check if blur target is a portal element (combobox/select/datepicker dropdown) */
function isBlurToPortal(e: React.FocusEvent): boolean {
    const target = e.relatedTarget as Element | null;
    if (!target) return true;
    if (e.currentTarget.contains(target)) return true;
    if (target.closest?.("[data-radix-popper-content-wrapper]")) return true;
    if (target.closest?.('[role="listbox"]')) return true;
    if (target.closest?.('[role="dialog"]')) return true;
    return false;
}

// ── Unified row list types ──────────────────────────────────────

type UnifiedRow<TData> =
    | { kind: "data"; row: Row<TData>; rowIndex: number }
    | { kind: "new-single"; rowIndex: number }
    | { kind: "new-multi"; state: NewRowState; stateIndex: number; rowIndex: number };

function buildUnifiedRows<TData>(
    dataRows: Row<TData>[],
    position: "start" | "end",
    newRowMode: "none" | "single" | "multi",
    visibleNewRows: NewRowState[],
): UnifiedRow<TData>[] {
    if (newRowMode === "none") {
        return dataRows.map((row, i) => ({ kind: "data", row, rowIndex: i }));
    }

    const newItems: UnifiedRow<TData>[] =
        newRowMode === "single"
            ? [{ kind: "new-single", rowIndex: 0 }]
            : visibleNewRows.map((state, i) => ({
                  kind: "new-multi",
                  state,
                  stateIndex: i,
                  rowIndex: i,
              }));

    if (position === "start") {
        // New rows first, then data rows with offset indices
        const offset = newItems.length;
        const dataItems: UnifiedRow<TData>[] = dataRows.map((row, i) => ({
            kind: "data",
            row,
            rowIndex: offset + i,
        }));
        // Fix new row indices (already correct: 0..M-1)
        return [...newItems, ...dataItems];
    }

    // position === "end": data rows first, then new rows with offset
    const dataItems: UnifiedRow<TData>[] = dataRows.map((row, i) => ({
        kind: "data",
        row,
        rowIndex: i,
    }));
    const offset = dataRows.length;
    const reindexed: UnifiedRow<TData>[] = newItems.map((item, i) => ({
        ...item,
        rowIndex: offset + i,
    }));
    return [...dataItems, ...reindexed];
}

// ── MemoizedDataRow ─────────────────────────────────────────────
// Wraps a single data <tr>. Skips re-render unless the row's data, selection,
// loading flag, or className changes. `renderCells` and `onRowClick` are
// expected to be stable callbacks (the parent threads them through refs).

interface MemoizedDataRowProps {
    row: Row<unknown>;
    rowIndex: number;
    isSelected: boolean;
    isLoading: boolean;
    className: string;
    onRowClick?: (data: unknown) => void;
    renderCells: (row: Row<unknown>, rowIndex: number) => React.ReactNode;
}

const MemoizedDataRow = React.memo(
    function MemoizedDataRow({
        row,
        rowIndex,
        isSelected,
        className,
        onRowClick,
        renderCells,
    }: MemoizedDataRowProps) {
        const handleClick = onRowClick ? () => onRowClick(row.original) : undefined;
        return (
            <tr
                data-state={isSelected ? "selected" : undefined}
                className={className}
                onClick={handleClick}
            >
                {renderCells(row, rowIndex)}
            </tr>
        );
    },
    (prev, next) =>
        // Don't compare `row` by reference — TanStack Table may recreate Row
        // instances between renders even when the underlying data is stable.
        // `row.original` identity plus `row.id` is the reliable signal.
        prev.row.id === next.row.id &&
        prev.row.original === next.row.original &&
        prev.rowIndex === next.rowIndex &&
        prev.isSelected === next.isSelected &&
        prev.isLoading === next.isLoading &&
        prev.className === next.className &&
        prev.onRowClick === next.onRowClick &&
        prev.renderCells === next.renderCells,
);

// ── MemoizedMultiNewRow ─────────────────────────────────────────
// Wraps a single draft <tr> for multi-row entry. useMultiRowState keeps the
// identity of untouched NewRowState entries stable (prev.map returns `row`
// as-is when id doesn't match), so a keystroke in one draft row doesn't
// force the others to re-render.

interface MemoizedMultiNewRowProps {
    state: NewRowState;
    rowIndex: number;
    stateIndex: number;
    enableRowSelection: boolean;
    onFocus?: (rowId: string) => void;
    onBlur?: (rowId: string) => void;
    renderCells: (state: NewRowState, stateIndex: number, rowIndex: number) => React.ReactNode;
}

const MemoizedMultiNewRow = React.memo(
    function MemoizedMultiNewRow({
        state,
        rowIndex,
        stateIndex,
        enableRowSelection,
        onFocus,
        onBlur,
        renderCells,
    }: MemoizedMultiNewRowProps) {
        return (
            <tr
                id={state.id}
                data-testid="new-row"
                data-row-id={state.id}
                onFocus={onFocus ? () => onFocus(state.id) : undefined}
                onBlur={
                    onBlur
                        ? (e) => {
                              if (!isBlurToPortal(e)) {
                                  setTimeout(() => onBlur(state.id), 200);
                              }
                          }
                        : undefined
                }
                className="border-b"
            >
                {enableRowSelection && (
                    <TableCell>
                        <Checkbox />
                    </TableCell>
                )}
                {renderCells(state, stateIndex, rowIndex)}
            </tr>
        );
    },
    (prev, next) =>
        prev.state === next.state &&
        prev.rowIndex === next.rowIndex &&
        prev.stateIndex === next.stateIndex &&
        prev.enableRowSelection === next.enableRowSelection &&
        prev.onFocus === next.onFocus &&
        prev.onBlur === next.onBlur &&
        prev.renderCells === next.renderCells,
);

// ── Component ───────────────────────────────────────────────────

interface DataTableBodyProps<TData> {
    table: TanStackTable<TData>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack Table ColumnDef requires `any` for heterogeneous column value types
    columns: ColumnDef<TData, any>[];
    isVirtualActive?: boolean;
    scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
    scrollElement?: HTMLDivElement | null;
    enableEditing?: boolean;
    onCellEdit?: (rowIndex: number, columnId: string, value: unknown) => void;
    enableNewRow?: boolean;
    newRowPosition?: "start" | "end";
    onNewRowSave?: (data: Record<string, unknown>) => void;
    onNewRowChange?: (data: Record<string, unknown>) => void;
    newRowDefaultValues?: Partial<TData>;
    enableRowSelection?: boolean;
    onRowClick?: (row: TData) => void;
    translations?: { noResults?: string };

    // Multi-row config. useMultiRowState lives inside the body so that keystrokes
    // in a pending row don't rerender the whole table (Toolbar, Headers, etc.).
    enableMultipleNewRows?: boolean;
    multiRowCount?: number;
    multiRowIncrement?: number;
    multiRowMaxCount?: number;
    multiRowPosition?: "start" | "end";
    multiRowDefaultValues?: Record<string, unknown> | ((index: number) => Record<string, unknown>);
    multiRowValidate?: (values: Record<string, unknown>) => boolean | string;
    onMultiRowSave?: (
        values: Record<string, unknown>,
        rowId: string,
        linkedId?: unknown,
        // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- intentional: mirrors useMultiRowState.onSave
    ) => unknown | Promise<unknown>;
    onMultiRowChange?: (
        values: Record<string, unknown>,
        rowId: string,
    ) => Record<string, unknown> | void;
    onMultiRowError?: (error: unknown, rowId: string) => void;
    bodyApiRef?: React.RefObject<DataTableBodyApi | null>;
    onDragSumChange?: (
        sumInfo: {
            sum: number;
            count: number;
            excludedSum?: number;
            excludedCount?: number;
        } | null,
    ) => void;
    onDragSelectionChange?: (selectedRows: TData[]) => void;
    dragSumFilter?: (row: TData) => boolean;
    enableInfiniteScroll?: boolean;
    loadingRowIds?: Set<number>;
}

export function DataTableBody<TData>({
    table,
    columns,
    isVirtualActive,
    scrollContainerRef,
    scrollElement: scrollElementProp,
    enableEditing,
    onCellEdit,
    enableNewRow,
    newRowPosition = "end",
    onNewRowSave,
    onNewRowChange,
    newRowDefaultValues,
    enableRowSelection,
    onRowClick,
    translations,

    enableMultipleNewRows,
    multiRowCount = 15,
    multiRowIncrement = 15,
    multiRowMaxCount = 100,
    multiRowPosition = "end",
    multiRowDefaultValues,
    multiRowValidate,
    onMultiRowSave,
    onMultiRowChange,
    onMultiRowError,
    bodyApiRef,
    onDragSumChange,
    onDragSelectionChange,
    dragSumFilter,
    enableInfiniteScroll: _enableInfiniteScroll,
    loadingRowIds,
}: DataTableBodyProps<TData>) {
    // ── Multi-row state management (kept local to body so keystrokes
    //    in a pending row don't rerender the entire DataTable) ──
    const multiRow = useMultiRowState({
        enabled: !!enableMultipleNewRows,
        initialCount: multiRowCount,
        increment: multiRowIncrement,
        maxCount: multiRowMaxCount,
        defaultValues: multiRowDefaultValues,
        validate: multiRowValidate,
        onSave: onMultiRowSave,
        onChange: onMultiRowChange,
        onError: onMultiRowError,
    });

    const multiRowStates = multiRow.rowStates;
    const handleMultiRowChange = multiRow.handleChange;
    const onMultiRowFocus = multiRow.handleFocus;
    const onMultiRowBlur = multiRow.handleBlur;
    const onNeedMoreRows = multiRow.handleNeedMoreRows;

    // Expose imperative API to the parent DataTable via ref
    React.useEffect(() => {
        if (!bodyApiRef) return;
        bodyApiRef.current = {
            flushPendingRows: multiRow.flushPendingRows,
            appendRow: multiRow.appendRow,
        };
        return () => {
            if (bodyApiRef.current) bodyApiRef.current = null;
        };
    }, [bodyApiRef, multiRow.flushPendingRows, multiRow.appendRow]);

    // ── Auto-append on Enter in last enter-cell ─────────────────────
    // use-cell-navigation dispatches "datatable:request-append-row" on the
    // table container; we append a new pending row and focus its first
    // enter-flow input on the next frame.
    React.useEffect(() => {
        if (!enableMultipleNewRows) return;
        const container = scrollContainerRef?.current;
        if (!container) return;

        function focusFirstEnterCellInRow(newRowId: string) {
            const cont = scrollContainerRef?.current;
            if (!cont) return;
            const tr = cont.querySelector<HTMLElement>(`tr[data-row-id="${newRowId}"]`);
            if (!tr) return;
            const cells = Array.from(
                tr.querySelectorAll<HTMLTableCellElement>("td[data-row-index][data-column-id]"),
            );
            for (const td of cells) {
                if (td.hasAttribute("data-skip-on-enter")) continue;
                const input = td.querySelector<HTMLInputElement>('input, [role="combobox"]');
                if (input) {
                    input.focus();
                    input.select?.();
                    return;
                }
            }
        }

        const handleRequestAppendRow = () => {
            const newRowId = multiRow.appendRow();
            if (!newRowId) return;
            requestAnimationFrame(() => {
                // Two rAFs: one to let React commit the new row, another to
                // let the DOM mount before focusing.
                requestAnimationFrame(() => focusFirstEnterCellInRow(newRowId));
            });
        };

        container.addEventListener("datatable:request-append-row", handleRequestAppendRow);
        return () => {
            container.removeEventListener("datatable:request-append-row", handleRequestAppendRow);
        };
    }, [enableMultipleNewRows, scrollContainerRef, multiRow]);

    const rows = table.getRowModel().rows;
    const parentRef = React.useRef<HTMLTableSectionElement>(null);

    // ── Single new row state (uncontrolled) ─────────────────────
    const [singleNewRowValues, setSingleNewRowValues] = React.useState<Record<string, unknown>>(
        () => {
            if (!enableNewRow || enableMultipleNewRows) return {};
            const initial: Record<string, unknown> = {};
            for (const col of columns) {
                const key = "accessorKey" in col ? String(col.accessorKey) : col.id;
                if (key) {
                    initial[key] = (newRowDefaultValues as Record<string, unknown>)?.[key] ?? "";
                }
            }
            return initial;
        },
    );
    const [singleNewRowErrors, setSingleNewRowErrors] = React.useState<Record<string, string>>({});
    const singleNewRowInputRefs = React.useRef<Map<string, HTMLInputElement>>(new Map());

    // ── Multi new row input refs (keyed by row ID) ──────────────
    const multiRowInputRefs = React.useRef<Map<string, Map<string, HTMLInputElement>>>(new Map());

    // ── Filter out saved new rows (linkedId set = already persisted) ──
    // Row stays visible while isSaving, hidden once save completes (linkedId set).
    // Deduplication is implicit: saved rows disappear, data rows appear on refetch.
    const visibleNewRows = React.useMemo(() => {
        if (!enableMultipleNewRows || !multiRowStates.length) return [];
        return multiRowStates.filter((r) => !r.linkedId);
    }, [multiRowStates, enableMultipleNewRows]);

    // ── Unified row list ────────────────────────────────────────
    const newRowMode = enableMultipleNewRows
        ? "multi"
        : enableNewRow && onNewRowSave
          ? "single"
          : "none";
    const position = enableMultipleNewRows ? multiRowPosition : newRowPosition;

    const unifiedRows = React.useMemo(
        () => buildUnifiedRows(rows, position, newRowMode, visibleNewRows),
        [rows, position, newRowMode, visibleNewRows],
    );

    // ── Sticky column offsets ────────────────────────────────────
    // Map<columnId, { side, offset }>. Offsets accumulate from the outer
    // edge: the first left-sticky column sits at left:0, the second stacks
    // behind it at `col1.size`, and so on. Right-sticky offsets count from
    // the right edge in reverse column order.
    const stickyMap = React.useMemo(() => {
        const map = new Map<string, { side: "left" | "right"; offset: number }>();
        let leftOffset = 0;
        for (const col of columns) {
            const meta = col.meta;
            if (meta?.sticky !== "left") continue;
            const id = ("accessorKey" in col ? String(col.accessorKey) : col.id) ?? "";
            if (!id) continue;
            map.set(id, { side: "left", offset: leftOffset });
            leftOffset += col.size ?? 150;
        }
        let rightOffset = 0;
        for (let i = columns.length - 1; i >= 0; i--) {
            const col = columns[i];
            const meta = col.meta;
            if (meta?.sticky !== "right") continue;
            const id = ("accessorKey" in col ? String(col.accessorKey) : col.id) ?? "";
            if (!id) continue;
            map.set(id, { side: "right", offset: rightOffset });
            rightOffset += col.size ?? 150;
        }
        return map;
    }, [columns]);

    const getStickyStyle = React.useCallback(
        (columnId: string): React.CSSProperties | undefined => {
            const s = stickyMap.get(columnId);
            if (!s) return undefined;
            return s.side === "left"
                ? { position: "sticky", left: s.offset, zIndex: 2 }
                : { position: "sticky", right: s.offset, zIndex: 2 };
        },
        [stickyMap],
    );

    // ── Virtualizer ─────────────────────────────────────────────
    const virtualizer = useVirtualizer({
        count: isVirtualActive ? unifiedRows.length : 0,
        getScrollElement: () => scrollElementProp ?? scrollContainerRef?.current ?? null,
        estimateSize: () => VIRTUAL_ROW_HEIGHT_PX,
        overscan: VIRTUALIZER_OVERSCAN,
        enabled: !!isVirtualActive,
    });

    // Track scroll-in-progress so editable cells can swap heavy Radix
    // inputs for lightweight display divs while the user is scrolling.
    const isScrolling = useIsScrolling(scrollElementProp ?? scrollContainerRef?.current ?? null);

    // ── Lazy loading (virtual mode): trigger when near end ──────
    const range = virtualizer.range;
    React.useEffect(() => {
        if (!isVirtualActive || !enableMultipleNewRows || !onNeedMoreRows || !range) return;
        if (range.endIndex >= unifiedRows.length - LAZY_LOAD_THRESHOLD) {
            onNeedMoreRows();
        }
    }, [range, unifiedRows.length, onNeedMoreRows, isVirtualActive, enableMultipleNewRows]);

    // ── Lazy loading (non-virtual mode): IntersectionObserver sentinel ──
    const sentinelRef = React.useRef<HTMLTableRowElement>(null);
    React.useEffect(() => {
        if (isVirtualActive || !enableMultipleNewRows || !onNeedMoreRows) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    onNeedMoreRows();
                }
            },
            { rootMargin: "200px" },
        );

        if (sentinelRef.current) {
            observer.observe(sentinelRef.current);
        }

        return () => observer.disconnect();
    }, [onNeedMoreRows, isVirtualActive, enableMultipleNewRows]);

    // ── Imperative drag-sum (no React state → no re-renders during drag) ──
    const dragRef = React.useRef<{
        isDragging: boolean;
        startRow: number;
        startCol: string;
        currentRow: number;
        manual: Set<number>;
        anchor: number | null;
    }>({
        isDragging: false,
        startRow: -1,
        startCol: "",
        currentRow: -1,
        manual: new Set(),
        anchor: null,
    });

    const dragSumFilterRef = React.useRef(dragSumFilter);
    dragSumFilterRef.current = dragSumFilter;

    /** Get all selected row indices from current drag state */
    function getSelectedIndices(): Set<number> {
        const d = dragRef.current;
        const indices = new Set(d.manual);
        if (d.startRow >= 0 && d.currentRow >= 0) {
            const min = Math.min(d.startRow, d.currentRow);
            const max = Math.max(d.startRow, d.currentRow);
            for (let i = min; i <= max; i++) indices.add(i);
        }
        return indices;
    }

    /** Apply/remove highlight CSS classes directly on DOM (no re-render) */
    function updateHighlight() {
        const container = parentRef.current?.closest("table")?.parentElement;
        if (!container) return;
        const col = dragRef.current.startCol;
        // Remove all existing highlights
        container.querySelectorAll(`.${DRAG_SUM_HIGHLIGHT.split(" ")[0]}`).forEach((el) => {
            DRAG_SUM_HIGHLIGHT.split(" ").forEach((cls) => el.classList.remove(cls));
        });
        // Apply highlights to selected cells
        const indices = getSelectedIndices();
        for (const i of indices) {
            const td = container.querySelector<HTMLElement>(
                `td[data-row-index="${i}"][data-column-id="${col}"]`,
            );
            if (td) DRAG_SUM_HIGHLIGHT.split(" ").forEach((cls) => td.classList.add(cls));
        }
    }

    /** Compute sum and update React state (called only on mouseup or significant changes) */
    function commitDragSum() {
        const d = dragRef.current;
        const indices = getSelectedIndices();

        if (indices.size < 2 || d.startCol === "") {
            onDragSumChange?.(null);
            onDragSelectionChange?.([]);
            return;
        }

        let sum = 0;
        let excludedSum = 0;
        const filterFn = dragSumFilterRef.current;
        const selectedRows: TData[] = [];

        for (const i of indices) {
            const row = rows[i];
            if (!row) continue;
            selectedRows.push(row.original);
            const cell = row.getAllCells().find((c) => c.column.id === d.startCol);
            if (!cell) continue;
            const val = cell.getValue();
            let num = NaN;
            if (typeof val === "number") num = val;
            else if (typeof val === "string") num = Number(val.replace(/\s+/g, ""));
            if (!isNaN(num)) {
                if (filterFn && !filterFn(row.original)) excludedSum += num;
                else sum += num;
            }
        }

        React.startTransition(() => {
            // Only show sum badge if there are actual numeric values
            if (sum > 0 || excludedSum > 0) {
                onDragSumChange?.({ sum, count: indices.size, excludedSum, excludedCount: 0 });
            } else {
                onDragSumChange?.(null);
            }
            onDragSelectionChange?.(selectedRows);
        });
    }

    React.useEffect(() => {
        const handleMouseUp = () => {
            if (dragRef.current.isDragging) {
                dragRef.current.isDragging = false;
                // Defer sum computation to next frame so mouseup returns instantly
                requestAnimationFrame(() => commitDragSum());
            }
        };
        window.addEventListener("mouseup", handleMouseUp);

        // Clear drag-sum when keyboard navigation moves cursor
        const tableContainer = parentRef.current?.closest("[data-datatable]") as HTMLElement | null;
        const handleNavigate = () => {
            const d = dragRef.current;
            if (d.startRow >= 0) {
                d.manual.clear();
                d.startRow = -1;
                d.startCol = "";
                d.currentRow = -1;
                updateHighlight();
                React.startTransition(() => {
                    onDragSumChange?.(null);
                    onDragSelectionChange?.([]);
                });
            }
        };
        tableContainer?.addEventListener("datatable:navigate", handleNavigate);

        // Shift+Arrow extends drag-sum selection
        const handleShiftSelect = (evt: Event) => {
            const detail = (evt as CustomEvent<{ row: number; col: string }>).detail;
            const targetRow: number = detail.row;
            const targetCol: string = detail.col;
            const d = dragRef.current;
            // Initialize selection if not started
            if (d.startRow < 0) {
                const focused = document.activeElement?.closest<HTMLElement>("td[data-row-index]");
                const focusedRow = focused?.getAttribute("data-row-index");
                d.startRow = focusedRow != null ? Number(focusedRow) : targetRow;
                d.startCol = targetCol;
                d.anchor = d.startRow;
            }
            d.currentRow = targetRow;
            d.manual.clear();
            const anchorRow: number = d.anchor ?? d.startRow;
            const min = Math.min(anchorRow, targetRow);
            const max = Math.max(anchorRow, targetRow);
            for (let i = min; i <= max; i++) d.manual.add(i);
            updateHighlight();
            requestAnimationFrame(() => commitDragSum());
        };
        tableContainer?.addEventListener("datatable:shift-select", handleShiftSelect);

        return () => {
            window.removeEventListener("mouseup", handleMouseUp);
            tableContainer?.removeEventListener("datatable:navigate", handleNavigate);
            tableContainer?.removeEventListener("datatable:shift-select", handleShiftSelect);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- commitDragSum uses refs, stable across renders
    }, [rows]);

    // ── Data row cell renderer ──────────────────────────────────
    const renderCells = (
        row: Row<TData>,
        rowIndex: number,
        extraCellStyle?: React.CSSProperties,
    ) => {
        const rowId = (row.original as { id?: number }).id;
        const isRowLoading = loadingRowIds != null && rowId != null && loadingRowIds.has(rowId);
        let isFirstCell = true;

        return row.getVisibleCells().map((cell) => {
            const showSpinner = isRowLoading && isFirstCell;
            if (isFirstCell) isFirstCell = false;
            const isDragSumEnabled = cell.column.columnDef.meta?.enableDragSum;

            const stickyStyle = getStickyStyle(cell.column.id);
            return (
                <TableCell
                    key={cell.id}
                    data-row-index={rowIndex}
                    data-column-id={cell.column.id}
                    data-skip-on-enter={cell.column.columnDef.meta?.skipOnEnter ?? undefined}
                    tabIndex={-1}
                    style={{ width: cell.column.getSize(), ...extraCellStyle, ...stickyStyle }}
                    className={cn(
                        cell.column.columnDef.meta?.cellClassName,
                        enableEditing && !cell.column.columnDef.meta?.editable && "bg-muted",
                        isDragSumEnabled && "cursor-cell",
                        stickyStyle && "bg-background",
                    )}
                    onClick={(e) => {
                        // Prevent drag-sum clicks from triggering onRowClick (navigation)
                        if (isDragSumEnabled) e.stopPropagation();
                    }}
                    onDoubleClick={() => {
                        if (isDragSumEnabled && cell.column.columnDef.meta?.editable) {
                            const td = document.querySelector<HTMLElement>(
                                `td[data-row-index="${rowIndex}"][data-column-id="${cell.column.id}"]`,
                            );
                            td?.querySelector<HTMLInputElement>(
                                'input, [role="combobox"]',
                            )?.focus();
                        }
                    }}
                    onMouseDown={(e) => {
                        if (isDragSumEnabled) {
                            const focused = document.activeElement;
                            if (focused instanceof HTMLInputElement) focused.blur();
                            e.preventDefault();

                            const d = dragRef.current;

                            if (e.ctrlKey || e.metaKey) {
                                if (d.manual.has(rowIndex)) d.manual.delete(rowIndex);
                                else d.manual.add(rowIndex);
                                d.anchor = rowIndex;
                                if (!d.startCol) d.startCol = cell.column.id;
                                updateHighlight();
                                requestAnimationFrame(() => commitDragSum());
                                return;
                            }

                            if (e.shiftKey && d.anchor !== null) {
                                const min = Math.min(d.anchor, rowIndex);
                                const max = Math.max(d.anchor, rowIndex);
                                for (let i = min; i <= max; i++) d.manual.add(i);
                                if (!d.startCol) d.startCol = cell.column.id;
                                updateHighlight();
                                requestAnimationFrame(() => commitDragSum());
                                return;
                            }

                            // Plain click
                            d.manual.clear();
                            d.isDragging = true;
                            d.startRow = rowIndex;
                            d.startCol = cell.column.id;
                            d.currentRow = rowIndex;
                            d.anchor = rowIndex;
                            updateHighlight();
                            // Set cursor on the cell (e.preventDefault blocked native focus)
                            (e.currentTarget as HTMLElement).focus();
                        } else {
                            // Click on non-drag cell → clear selection
                            dragRef.current.manual.clear();
                            dragRef.current.startRow = -1;
                            dragRef.current.startCol = "";
                            dragRef.current.currentRow = -1;
                            updateHighlight();
                            onDragSumChange?.(null);
                            onDragSelectionChange?.([]);
                        }
                    }}
                    onMouseEnter={() => {
                        const d = dragRef.current;
                        if (d.isDragging && d.startRow >= 0) {
                            if (d.startRow !== rowIndex) {
                                const focused = document.activeElement;
                                if (focused instanceof HTMLInputElement) focused.blur();
                            }
                            d.currentRow = rowIndex;
                            updateHighlight();
                        }
                    }}
                >
                    {showSpinner ? (
                        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                    ) : enableEditing && cell.column.columnDef.meta?.editable ? (
                        <DataTableEditableCell
                            cell={cell.getContext()}
                            enableEditing
                            onCellEdit={onCellEdit}
                        />
                    ) : (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                    )}
                </TableCell>
            );
        });
    };

    // ── New row keyboard handler factory ─────────────────────────
    const editableColumns = React.useMemo(
        () => columns.filter((col) => col.meta?.editable),
        [columns],
    );

    const handleNewRowKeyDown = React.useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            e.preventDefault();
            (e.target as HTMLInputElement)?.blur();
        }
        // Enter and Tab navigation handled by use-cell-navigation.ts (capture phase).
        // Save is handled by blur-save in use-multi-row-state.ts handleBlur.
    }, []);

    // ── Single new row save handler ─────────────────────────────
    const handleSingleNewRowSave = React.useCallback(
        (currentValues: Record<string, unknown> = singleNewRowValues) => {
            // Validate
            const newErrors: Record<string, string> = {};
            let hasError = false;
            for (const col of editableColumns) {
                const key = "accessorKey" in col ? String(col.accessorKey) : col.id;
                if (!key) continue;
                const meta = col.meta;
                if (meta?.validationSchema) {
                    const result = meta.validationSchema.safeParse(currentValues[key]);
                    if (!result.success) {
                        newErrors[key] = result.error.issues[0]?.message ?? "Invalid";
                        hasError = true;
                    }
                }
            }
            if (hasError) {
                setSingleNewRowErrors(newErrors);
                return;
            }
            setSingleNewRowErrors({});
            onNewRowSave?.(currentValues);
            // Reset
            const reset: Record<string, unknown> = {};
            for (const col of columns) {
                const key = "accessorKey" in col ? String(col.accessorKey) : col.id;
                if (key) reset[key] = "";
            }
            setSingleNewRowValues(reset);
        },
        [singleNewRowValues, editableColumns, columns, onNewRowSave],
    );

    // ── Multi new row cell renderer ─────────────────────────────
    const renderMultiNewRowCells = React.useCallback(
        (state: NewRowState, _stateIndex: number, rowIndex: number) => {
            // Ensure refs map exists for this row
            if (!multiRowInputRefs.current.has(state.id)) {
                multiRowInputRefs.current.set(state.id, new Map());
            }
            const inputRefsMap = multiRowInputRefs.current.get(state.id)!;

            return columns.map((col, colIndex) => {
                const key = "accessorKey" in col ? String(col.accessorKey) : col.id;
                if (!key) return <TableCell key={col.id ?? `empty-${colIndex}`} />;

                const meta = col.meta;
                const stickyStyle = getStickyStyle(key);
                if (!meta?.editable) {
                    const val = state.values[key];
                    const displayVal =
                        typeof val === "number"
                            ? val.toLocaleString()
                            : val !== undefined && val !== ""
                              ? toDisplayString(val)
                              : "";

                    return (
                        <TableCell
                            key={key}
                            data-row-index={rowIndex}
                            data-column-id={key}
                            tabIndex={-1}
                            style={stickyStyle}
                            className={cn(
                                "bg-muted text-sm",
                                meta?.align === "right" && "text-right",
                                meta?.align === "center" && "text-center",
                                "text-muted-foreground",
                                stickyStyle && "bg-background",
                                meta?.cellClassName,
                            )}
                        >
                            {state.isSaving && colIndex === 0 ? (
                                <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                            ) : (
                                displayVal
                            )}
                        </TableCell>
                    );
                }

                const error = state.errors[key];

                return (
                    <TableCell
                        key={key}
                        data-row-index={rowIndex}
                        data-column-id={key}
                        data-skip-on-enter={meta?.skipOnEnter ?? undefined}
                        tabIndex={-1}
                        style={stickyStyle}
                        className={cn(
                            "relative",
                            stickyStyle && "bg-background",
                            meta?.cellClassName,
                        )}
                    >
                        <DataTableCellInput
                            meta={meta}
                            value={state.values[key]}
                            error={error}
                            onChange={(newValue) => {
                                handleMultiRowChange(state.id, {
                                    ...state.values,
                                    [key]: newValue,
                                });
                            }}
                            onSelect={
                                meta.inputType === "combobox" || meta.inputType === "select"
                                    ? (newValue) => {
                                          handleMultiRowChange(state.id, {
                                              ...state.values,
                                              [key]: newValue,
                                          });
                                      }
                                    : undefined
                            }
                            onKeyDown={handleNewRowKeyDown}
                            inputRef={(el) => {
                                if (el) inputRefsMap.set(key, el);
                            }}
                            className={GHOST_INPUT_CLASS}
                        />
                        {error && (
                            <p className="text-destructive absolute -bottom-1 left-2 text-xs">
                                {error}
                            </p>
                        )}
                    </TableCell>
                );
            });
        },
        [columns, getStickyStyle, handleMultiRowChange, handleNewRowKeyDown],
    );

    // ── Single new row cell renderer ────────────────────────────
    const renderSingleNewRowCells = React.useCallback(
        (rowIndex: number) => {
            return columns.map((col, colIndex) => {
                const key = "accessorKey" in col ? String(col.accessorKey) : col.id;
                if (!key) return <TableCell key={col.id ?? `empty-${colIndex}`} />;

                const meta = col.meta;
                const stickyStyle = getStickyStyle(key);
                if (!meta?.editable) {
                    const val = singleNewRowValues[key];
                    const displayVal =
                        typeof val === "number"
                            ? val.toLocaleString()
                            : val !== undefined && val !== ""
                              ? toDisplayString(val)
                              : "";

                    return (
                        <TableCell
                            key={key}
                            data-row-index={rowIndex}
                            data-column-id={key}
                            tabIndex={-1}
                            style={stickyStyle}
                            className={cn(
                                "bg-muted text-sm",
                                meta?.align === "right" && "text-right",
                                meta?.align === "center" && "text-center",
                                "text-muted-foreground",
                                stickyStyle && "bg-background",
                                meta?.cellClassName,
                            )}
                        >
                            {displayVal}
                        </TableCell>
                    );
                }

                const error = singleNewRowErrors[key];

                return (
                    <TableCell
                        key={key}
                        data-row-index={rowIndex}
                        data-column-id={key}
                        data-skip-on-enter={meta?.skipOnEnter ?? undefined}
                        tabIndex={-1}
                        style={stickyStyle}
                        className={cn(
                            "relative",
                            stickyStyle && "bg-background",
                            meta?.cellClassName,
                        )}
                    >
                        <DataTableCellInput
                            meta={meta}
                            value={singleNewRowValues[key]}
                            error={error}
                            onChange={(newValue) => {
                                const updated = { ...singleNewRowValues, [key]: newValue };
                                setSingleNewRowValues(updated);
                                setSingleNewRowErrors((prev) => {
                                    const next = { ...prev };
                                    delete next[key];
                                    return next;
                                });
                                onNewRowChange?.(updated);
                            }}
                            onKeyDown={handleNewRowKeyDown}
                            inputRef={(el) => {
                                if (el) singleNewRowInputRefs.current.set(key, el);
                            }}
                            className={GHOST_INPUT_CLASS}
                        />
                        {error && (
                            <p className="text-destructive absolute -bottom-1 left-2 text-xs">
                                {error}
                            </p>
                        )}
                    </TableCell>
                );
            });
        },
        [
            columns,
            getStickyStyle,
            singleNewRowValues,
            singleNewRowErrors,
            onNewRowChange,
            handleNewRowKeyDown,
        ],
    );

    // ── Stable wrappers (so MemoizedDataRow can skip re-renders) ──
    // We thread the latest props through a ref and expose stable callback
    // identities to the memoized row. Without this, every parent render
    // produces fresh function instances that defeat React.memo.
    const renderCellsRef = React.useRef(renderCells);
    renderCellsRef.current = renderCells;
    const stableRenderCells = React.useCallback(
        (row: Row<unknown>, rowIndex: number) =>
            renderCellsRef.current(row as Row<TData>, rowIndex),
        [],
    );

    const onRowClickRef = React.useRef(onRowClick);
    onRowClickRef.current = onRowClick;
    const stableOnRowClick = React.useMemo(
        () => (onRowClick ? (data: unknown) => onRowClickRef.current?.(data as TData) : undefined),
        [onRowClick],
    );

    // Stable wrappers for multi-new-row callbacks + renderer so that
    // MemoizedMultiNewRow can bail out when a sibling row changes.
    const renderMultiNewRowCellsRef = React.useRef(renderMultiNewRowCells);
    renderMultiNewRowCellsRef.current = renderMultiNewRowCells;
    const stableRenderMultiNewRowCells = React.useCallback(
        (state: NewRowState, stateIndex: number, rowIndex: number) =>
            renderMultiNewRowCellsRef.current(state, stateIndex, rowIndex),
        [],
    );

    const onMultiRowFocusRef = React.useRef(onMultiRowFocus);
    onMultiRowFocusRef.current = onMultiRowFocus;
    const stableOnMultiRowFocus = React.useMemo(
        () => (rowId: string) => onMultiRowFocusRef.current(rowId),
        [],
    );

    const onMultiRowBlurRef = React.useRef(onMultiRowBlur);
    onMultiRowBlurRef.current = onMultiRowBlur;
    const stableOnMultiRowBlur = React.useMemo(
        () => (rowId: string) => onMultiRowBlurRef.current(rowId),
        [],
    );

    const dataRowClassName = cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        onRowClick ? "cursor-pointer" : "",
    );

    // ── Render a unified row by kind ────────────────────────────
    const renderUnifiedRow = (item: UnifiedRow<TData>) => {
        if (item.kind === "data") {
            const { row, rowIndex } = item;
            const rowOriginalId = (row.original as { id?: number }).id;
            const isLoading =
                loadingRowIds != null && rowOriginalId != null && loadingRowIds.has(rowOriginalId);
            return (
                <MemoizedDataRow
                    key={row.id}
                    row={row as Row<unknown>}
                    rowIndex={rowIndex}
                    isSelected={row.getIsSelected()}
                    isLoading={isLoading}
                    className={dataRowClassName}
                    onRowClick={stableOnRowClick}
                    renderCells={stableRenderCells}
                />
            );
        }

        if (item.kind === "new-multi") {
            const { state, stateIndex, rowIndex } = item;
            return (
                <MemoizedMultiNewRow
                    key={state.id}
                    state={state}
                    rowIndex={rowIndex}
                    stateIndex={stateIndex}
                    enableRowSelection={!!enableRowSelection}
                    onFocus={stableOnMultiRowFocus}
                    onBlur={stableOnMultiRowBlur}
                    renderCells={stableRenderMultiNewRowCells}
                />
            );
        }

        // kind === "new-single"
        return (
            <tr
                key="new-row"
                id="new-row"
                data-testid="new-row"
                data-row-id="new-row"
                className="border-b"
                onBlur={(e) => {
                    if (!isBlurToPortal(e)) {
                        setTimeout(() => handleSingleNewRowSave(), 200);
                    }
                }}
            >
                {enableRowSelection && (
                    <TableCell>
                        <Checkbox />
                    </TableCell>
                )}
                {renderSingleNewRowCells(item.rowIndex)}
            </tr>
        );
    };

    // ── Empty state ─────────────────────────────────────────────
    if (rows.length === 0 && newRowMode === "none") {
        return (
            <DataTableScrollingContext value={isScrolling}>
                <TableBody className={"select-none"}>
                    <TableRow>
                        <TableCell
                            colSpan={columns.length + (enableRowSelection ? 1 : 0)}
                            className="h-24 text-center"
                        >
                            {translations?.noResults ?? "No results."}
                        </TableCell>
                    </TableRow>
                </TableBody>
            </DataTableScrollingContext>
        );
    }

    // ── Virtualized mode ────────────────────────────────────────
    if (isVirtualActive) {
        const virtualRows = virtualizer.getVirtualItems();
        const totalSize = virtualizer.getTotalSize();
        const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
        const paddingBottom =
            virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

        return (
            <DataTableScrollingContext value={isScrolling}>
                <TableBody ref={parentRef} className={"select-none"}>
                    {paddingTop > 0 && (
                        <tr>
                            <td style={{ height: paddingTop, padding: 0 }} />
                        </tr>
                    )}
                    {virtualRows.map((virtualRow) => {
                        const item = unifiedRows[virtualRow.index];
                        if (!item) return null;
                        if (item.kind === "data") {
                            const rowOriginalId = (item.row.original as { id?: number }).id;
                            const isLoading =
                                loadingRowIds != null &&
                                rowOriginalId != null &&
                                loadingRowIds.has(rowOriginalId);
                            return (
                                <MemoizedDataRow
                                    key={item.row.id}
                                    row={item.row as Row<unknown>}
                                    rowIndex={item.rowIndex}
                                    isSelected={item.row.getIsSelected()}
                                    isLoading={isLoading}
                                    className={cn(onRowClick ? "cursor-pointer" : "")}
                                    onRowClick={stableOnRowClick}
                                    renderCells={stableRenderCells}
                                />
                            );
                        }
                        return renderUnifiedRow(item);
                    })}
                    {paddingBottom > 0 && (
                        <tr>
                            <td style={{ height: paddingBottom, padding: 0 }} />
                        </tr>
                    )}
                </TableBody>
            </DataTableScrollingContext>
        );
    }

    // ── Non-virtual mode ────────────────────────────────────────
    return (
        <DataTableScrollingContext value={isScrolling}>
            <TableBody className={"select-none"}>
                {unifiedRows.map((item) => renderUnifiedRow(item))}
                {enableMultipleNewRows && !isVirtualActive && (
                    <tr
                        ref={sentinelRef}
                        style={{ height: 1, visibility: "hidden" }}
                        aria-hidden="true"
                    >
                        <td />
                    </tr>
                )}
            </TableBody>
        </DataTableScrollingContext>
    );
}
