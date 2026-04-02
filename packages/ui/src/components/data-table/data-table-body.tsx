import * as React from "react";

import { flexRender } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";

import { cn } from "../../lib/utils";
import { Checkbox } from "../ui/checkbox";
import { TableBody, TableCell, TableRow } from "../ui/table";
import { DataTableCellInput, GHOST_INPUT_CLASS, toDisplayString } from "./data-table-cell-input";
import { DataTableEditableCell } from "./data-table-editable-cell";

import type { NewRowState } from "./types";
import type { ColumnDef, Row, Table as TanStackTable } from "@tanstack/react-table";

const VIRTUAL_ROW_HEIGHT_PX = 36;
const VIRTUALIZER_OVERSCAN = 20;
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

    // Multi-row props
    enableMultipleNewRows?: boolean;
    multiRowStates?: NewRowState[];
    multiRowPosition?: "start" | "end";
    onMultiRowChange?: (rowId: string, values: Record<string, unknown>) => void;
    onMultiRowSave?: (rowId: string) => void;
    onMultiRowFocus?: (rowId: string) => void;
    onMultiRowBlur?: (rowId: string) => void;
    onMultiRowFocusNext?: (rowId: string) => void;
    onMultiRowSaveAndLoop?: (rowId: string) => Promise<boolean>;
    onNeedMoreRows?: () => void;
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
    multiRowStates = [],
    multiRowPosition = "end",
    onMultiRowChange,
    onMultiRowSave,
    onMultiRowFocus,
    onMultiRowBlur,
    onMultiRowFocusNext,
    onMultiRowSaveAndLoop,
    onNeedMoreRows,
    onDragSumChange,
    onDragSelectionChange,
    dragSumFilter,
    enableInfiniteScroll,
    loadingRowIds,
}: DataTableBodyProps<TData>) {
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

    // ── Deduplication: filter out new rows whose linkedId is already in data ──
    const visibleNewRows = React.useMemo(() => {
        if (!enableMultipleNewRows || !multiRowStates.length) return [];
        const dataIds = new Set(
            rows.map((r) => (r.original as { id?: unknown }).id).filter(Boolean),
        );
        return multiRowStates.filter((r) => !r.linkedId || !dataIds.has(r.linkedId));
    }, [rows, multiRowStates, enableMultipleNewRows]);

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

    // ── Virtualizer ─────────────────────────────────────────────
    const virtualizer = useVirtualizer({
        count: isVirtualActive ? unifiedRows.length : 0,
        getScrollElement: () => scrollElementProp ?? scrollContainerRef?.current ?? null,
        estimateSize: () => VIRTUAL_ROW_HEIGHT_PX,
        overscan: VIRTUALIZER_OVERSCAN,
        enabled: !!isVirtualActive,
    });

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

            return (
                <TableCell
                    key={cell.id}
                    data-row-index={rowIndex}
                    data-column-id={cell.column.id}
                    tabIndex={-1}
                    style={{ width: cell.column.getSize(), ...extraCellStyle }}
                    className={cn(
                        cell.column.columnDef.meta?.cellClassName,
                        enableEditing && !cell.column.columnDef.meta?.editable && "bg-muted",
                        isDragSumEnabled && "cursor-cell",
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

    const makeNewRowKeyDown = (
        _rowId: string,
        colIndex: number,
        inputRefsMap: Map<string, HTMLInputElement>,
        saveFn: () => void,
        saveAndLoopFn?: () => Promise<boolean>,
        focusNextRowFn?: () => void,
    ) => {
        return (e: React.KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                (e.target as HTMLInputElement)?.blur();
                return;
            }
            if (e.key === "Enter") {
                e.preventDefault();
                if (colIndex === editableColumns.length - 1) {
                    // Last editable column → save and move to next row
                    if (saveAndLoopFn) {
                        void saveAndLoopFn().then(() => focusNextRowFn?.());
                    } else {
                        saveFn();
                        focusNextRowFn?.();
                    }
                } else {
                    const nextCol = editableColumns[colIndex + 1];
                    const nextKey =
                        nextCol &&
                        ("accessorKey" in nextCol ? String(nextCol.accessorKey) : nextCol.id);
                    const nextInput = nextKey ? inputRefsMap.get(nextKey) : null;
                    if (nextInput) nextInput.focus();
                    else saveFn();
                }
            } else if (e.key === "Tab" && !e.shiftKey && colIndex === editableColumns.length - 1) {
                e.preventDefault();
                // Last column Tab → save and move to next row
                if (saveAndLoopFn) {
                    void saveAndLoopFn().then(() => focusNextRowFn?.());
                } else if (focusNextRowFn) {
                    saveFn();
                    focusNextRowFn();
                }
            }
        };
    };

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
    const renderMultiNewRowCells = (state: NewRowState, _stateIndex: number, rowIndex: number) => {
        let editableIndex = 0;

        // Ensure refs map exists for this row
        if (!multiRowInputRefs.current.has(state.id)) {
            multiRowInputRefs.current.set(state.id, new Map());
        }
        const inputRefsMap = multiRowInputRefs.current.get(state.id)!;

        return columns.map((col, colIndex) => {
            const key = "accessorKey" in col ? String(col.accessorKey) : col.id;
            if (!key) return <TableCell key={col.id ?? `empty-${colIndex}`} />;

            const meta = col.meta;
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
                        className={cn(
                            "bg-muted text-sm",
                            meta?.align === "right" && "text-right",
                            meta?.align === "center" && "text-center",
                            "text-muted-foreground",
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

            const currentEditableIndex = editableIndex++;
            const error = state.errors[key];

            return (
                <TableCell
                    key={key}
                    data-row-index={rowIndex}
                    data-column-id={key}
                    tabIndex={-1}
                    className={cn("relative", meta?.cellClassName)}
                >
                    <DataTableCellInput
                        meta={meta}
                        value={state.values[key]}
                        error={error}
                        onChange={(newValue) => {
                            onMultiRowChange?.(state.id, {
                                ...state.values,
                                [key]: newValue,
                            });
                        }}
                        onKeyDown={makeNewRowKeyDown(
                            state.id,
                            currentEditableIndex,
                            inputRefsMap,
                            () => onMultiRowSave?.(state.id),
                            onMultiRowSaveAndLoop
                                ? () => onMultiRowSaveAndLoop(state.id)
                                : undefined,
                            () => onMultiRowFocusNext?.(state.id),
                        )}
                        inputRef={(el) => {
                            if (el) inputRefsMap.set(key, el);
                        }}
                        className={GHOST_INPUT_CLASS}
                    />
                    {error && (
                        <motion.p
                            initial={{ opacity: 0, x: 0 }}
                            animate={{ opacity: 1, x: [0, -4, 4, -4, 0] }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            className="text-destructive absolute -bottom-1 left-2 text-xs"
                        >
                            {error}
                        </motion.p>
                    )}
                </TableCell>
            );
        });
    };

    // ── Single new row cell renderer ────────────────────────────
    const renderSingleNewRowCells = (rowIndex: number) => {
        let editableIndex = 0;

        return columns.map((col, colIndex) => {
            const key = "accessorKey" in col ? String(col.accessorKey) : col.id;
            if (!key) return <TableCell key={col.id ?? `empty-${colIndex}`} />;

            const meta = col.meta;
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
                        className={cn(
                            "bg-muted text-sm",
                            meta?.align === "right" && "text-right",
                            meta?.align === "center" && "text-center",
                            "text-muted-foreground",
                            meta?.cellClassName,
                        )}
                    >
                        {displayVal}
                    </TableCell>
                );
            }

            const currentEditableIndex = editableIndex++;
            const error = singleNewRowErrors[key];

            return (
                <TableCell
                    key={key}
                    data-row-index={rowIndex}
                    data-column-id={key}
                    tabIndex={-1}
                    className={cn("relative", meta?.cellClassName)}
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
                        onKeyDown={makeNewRowKeyDown(
                            "new-row",
                            currentEditableIndex,
                            singleNewRowInputRefs.current,
                            () => handleSingleNewRowSave(),
                        )}
                        inputRef={(el) => {
                            if (el) singleNewRowInputRefs.current.set(key, el);
                        }}
                        className={GHOST_INPUT_CLASS}
                    />
                    {error && (
                        <motion.p
                            initial={{ opacity: 0, x: 0 }}
                            animate={{ opacity: 1, x: [0, -4, 4, -4, 0] }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            className="text-destructive absolute -bottom-1 left-2 text-xs"
                        >
                            {error}
                        </motion.p>
                    )}
                </TableCell>
            );
        });
    };

    // ── Render a unified row by kind ────────────────────────────
    const renderUnifiedRow = (item: UnifiedRow<TData>, useMotion: boolean) => {
        if (item.kind === "data") {
            const { row, rowIndex } = item;
            if (useMotion) {
                return (
                    <motion.tr
                        key={row.id}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        data-state={row.getIsSelected() ? "selected" : undefined}
                        className={cn(
                            "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
                            onRowClick ? "cursor-pointer" : "",
                        )}
                        onClick={() => onRowClick?.(row.original)}
                    >
                        {renderCells(row, rowIndex)}
                    </motion.tr>
                );
            }
            return (
                <tr
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={cn(
                        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
                        onRowClick ? "cursor-pointer" : "",
                    )}
                    onClick={() => onRowClick?.(row.original)}
                >
                    {renderCells(row, rowIndex)}
                </tr>
            );
        }

        if (item.kind === "new-multi") {
            const { state, stateIndex, rowIndex } = item;
            return (
                <tr
                    key={state.id}
                    id={state.id}
                    data-testid="new-row"
                    data-row-id={state.id}
                    onFocus={() => onMultiRowFocus?.(state.id)}
                    onBlur={(e) => {
                        if (!isBlurToPortal(e)) {
                            setTimeout(() => onMultiRowBlur?.(state.id), 200);
                        }
                    }}
                    className="border-b"
                >
                    {enableRowSelection && (
                        <TableCell>
                            <Checkbox />
                        </TableCell>
                    )}
                    {renderMultiNewRowCells(state, stateIndex, rowIndex)}
                </tr>
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
                        return (
                            <TableRow
                                key={item.row.id}
                                data-state={item.row.getIsSelected() ? "selected" : undefined}
                                className={cn(onRowClick ? "cursor-pointer" : "")}
                                onClick={() => onRowClick?.(item.row.original)}
                            >
                                {renderCells(item.row, item.rowIndex)}
                            </TableRow>
                        );
                    }
                    return renderUnifiedRow(item, false);
                })}
                {paddingBottom > 0 && (
                    <tr>
                        <td style={{ height: paddingBottom, padding: 0 }} />
                    </tr>
                )}
            </TableBody>
        );
    }

    // ── Non-virtual mode ────────────────────────────────────────
    return (
        <TableBody className={"select-none"}>
            {unifiedRows.map((item) => renderUnifiedRow(item, !enableInfiniteScroll))}
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
    );
}
