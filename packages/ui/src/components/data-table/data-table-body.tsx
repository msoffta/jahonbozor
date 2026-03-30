import * as React from "react";

import { flexRender } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";

import { cn } from "../../lib/utils";
import { TableBody, TableCell, TableRow } from "../ui/table";
import { DataTableEditableCell } from "./data-table-editable-cell";
import { DataTableMultiNewRows } from "./data-table-multi-new-rows";
import { DataTableNewRow } from "./data-table-new-row";

import type { NewRowState } from "./types";
import type { ColumnDef, Row, Table as TanStackTable } from "@tanstack/react-table";

const VIRTUAL_ROW_HEIGHT_PX = 36;
const VIRTUALIZER_OVERSCAN = 20;
// eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op for optional callbacks
const NOOP = () => {};

const DRAG_SUM_HIGHLIGHT = "bg-drag-sum ring-1 ring-inset ring-drag-sum-border";

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
    multiRowDefaultValues?: Partial<TData> | ((index: number) => Partial<TData>);
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
    multiRowDefaultValues,
    onDragSumChange,
    onDragSelectionChange,
    dragSumFilter,
    enableInfiniteScroll,
    loadingRowIds,
}: DataTableBodyProps<TData>) {
    const rows = table.getRowModel().rows;
    const parentRef = React.useRef<HTMLTableSectionElement>(null);

    const virtualizer = useVirtualizer({
        count: isVirtualActive ? rows.length : 0,
        getScrollElement: () => scrollElementProp ?? scrollContainerRef?.current ?? null,
        estimateSize: () => VIRTUAL_ROW_HEIGHT_PX,
        overscan: VIRTUALIZER_OVERSCAN,
        enabled: !!isVirtualActive,
    });

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

    // Memoize new rows so drag-sum state changes don't re-render 50+ ghost rows
    const defaultValuesFactory = React.useCallback(
        (index: number) =>
            typeof multiRowDefaultValues === "function"
                ? multiRowDefaultValues(index)
                : { ...multiRowDefaultValues },
        [multiRowDefaultValues],
    );

    const singleNewRow = React.useMemo(
        () =>
            enableNewRow && !enableMultipleNewRows && onNewRowSave ? (
                <DataTableNewRow
                    columns={columns}
                    onSave={onNewRowSave}
                    onChange={onNewRowChange}
                    defaultValues={newRowDefaultValues}
                    enableRowSelection={enableRowSelection}
                    rowIndex={rows.length}
                />
            ) : null,
        [
            rows.length,
            columns,
            enableNewRow,
            enableMultipleNewRows,
            onNewRowSave,
            onNewRowChange,
            newRowDefaultValues,
            enableRowSelection,
        ],
    );

    const multiNewRows = React.useMemo(
        () =>
            enableMultipleNewRows && onMultiRowSave && onMultiRowChange ? (
                <DataTableMultiNewRows
                    columns={columns}
                    rowStates={multiRowStates}
                    onRowChange={onMultiRowChange}
                    onRowSave={onMultiRowSave}
                    onRowFocus={onMultiRowFocus}
                    onRowBlur={onMultiRowBlur}
                    onRowFocusNext={onMultiRowFocusNext}
                    onRowSaveAndLoop={onMultiRowSaveAndLoop}
                    enableRowSelection={enableRowSelection}
                    defaultValuesFactory={defaultValuesFactory}
                    onNeedMoreRows={onNeedMoreRows ?? NOOP}
                    dataRowCount={rows.length}
                />
            ) : null,
        [
            rows.length,
            columns,
            enableMultipleNewRows,
            multiRowStates,
            onMultiRowChange,
            onMultiRowSave,
            onMultiRowFocus,
            onMultiRowBlur,
            onMultiRowFocusNext,
            onMultiRowSaveAndLoop,
            enableRowSelection,
            defaultValuesFactory,
            onNeedMoreRows,
        ],
    );

    const newRows = enableMultipleNewRows ? multiNewRows : singleNewRow;
    const position = enableMultipleNewRows ? multiRowPosition : newRowPosition;

    if (rows.length === 0 && !enableNewRow && !enableMultipleNewRows) {
        return (
            <TableBody className={"select-none"}>
                {position === "start" && newRows}
                <TableRow>
                    <TableCell
                        colSpan={columns.length + (enableRowSelection ? 1 : 0)}
                        className="h-24 text-center"
                    >
                        {translations?.noResults ?? "No results."}
                    </TableCell>
                </TableRow>
                {position === "end" && newRows}
            </TableBody>
        );
    }

    // Virtualized mode — use padding to maintain scroll height while only
    // rendering visible rows. Keeps normal <table> layout (no display:grid).
    if (isVirtualActive) {
        const virtualRows = virtualizer.getVirtualItems();
        const totalSize = virtualizer.getTotalSize();
        const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
        const paddingBottom =
            virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

        return (
            <TableBody ref={parentRef} className={"select-none"}>
                {position === "start" && newRows}
                {paddingTop > 0 && (
                    <tr>
                        <td style={{ height: paddingTop, padding: 0 }} />
                    </tr>
                )}
                {virtualRows.map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    return (
                        <TableRow
                            key={row.id}
                            data-state={row.getIsSelected() ? "selected" : undefined}
                            className={cn(onRowClick ? "cursor-pointer" : "")}
                            onClick={() => onRowClick?.(row.original)}
                        >
                            {renderCells(row, virtualRow.index)}
                        </TableRow>
                    );
                })}
                {paddingBottom > 0 && (
                    <tr>
                        <td style={{ height: paddingBottom, padding: 0 }} />
                    </tr>
                )}
                {position === "end" && newRows}
            </TableBody>
        );
    }

    // Show-all / paginated mode — same rendering, only virtualized differs
    return (
        <TableBody className={"select-none"}>
            {position === "start" && newRows}
            {rows.map((row, index) =>
                enableInfiniteScroll ? (
                    <tr
                        key={row.id}
                        data-state={row.getIsSelected() ? "selected" : undefined}
                        className={cn(
                            "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
                            onRowClick ? "cursor-pointer" : "",
                        )}
                        onClick={() => onRowClick?.(row.original)}
                    >
                        {renderCells(row, index)}
                    </tr>
                ) : (
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
                        {renderCells(row, index)}
                    </motion.tr>
                ),
            )}
            {position === "end" && newRows}
        </TableBody>
    );
}
