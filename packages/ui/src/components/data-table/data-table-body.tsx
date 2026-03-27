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
    onDragSumChange?: (sumInfo: { sum: number; count: number } | null) => void;
    onDragSelectionChange?: (selectedRows: TData[]) => void;
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

    const [isDragging, setIsDragging] = React.useState(false);
    const [dragStart, setDragStart] = React.useState<{ row: number; col: string } | null>(null);
    const [dragCurrent, setDragCurrent] = React.useState<{ row: number } | null>(null);

    // Ctrl/Shift click selection
    const [manualSelection, setManualSelection] = React.useState<Set<number>>(new Set());
    const anchorRowRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        const handleMouseUp = () => setIsDragging(false);
        window.addEventListener("mouseup", handleMouseUp);
        return () => window.removeEventListener("mouseup", handleMouseUp);
    }, []);

    // Merge drag range + manual (Ctrl/Shift) selection
    const allSelectedIndices = React.useMemo(() => {
        const indices = new Set(manualSelection);
        if (dragStart && dragCurrent) {
            const min = Math.min(dragStart.row, dragCurrent.row);
            const max = Math.max(dragStart.row, dragCurrent.row);
            for (let i = min; i <= max; i++) indices.add(i);
        }
        return indices;
    }, [dragStart, dragCurrent, manualSelection]);

    const selectedAreaSum = React.useMemo(() => {
        if (!dragStart || allSelectedIndices.size < 2) return 0;

        let sum = 0;
        for (const i of allSelectedIndices) {
            const row = rows[i];
            if (!row) continue;

            const cell = row.getAllCells().find((c) => c.column.id === dragStart.col);
            if (!cell) continue;

            const val = cell.getValue();
            let num = NaN;
            if (typeof val === "number") {
                num = val;
            } else if (typeof val === "string") {
                num = Number(val.replace(/\s+/g, ""));
            }

            if (!isNaN(num)) sum += num;
        }
        return sum;
    }, [dragStart, allSelectedIndices, rows]);

    React.useEffect(() => {
        if (onDragSumChange) {
            if (selectedAreaSum > 0 && allSelectedIndices.size >= 2) {
                onDragSumChange({ sum: selectedAreaSum, count: allSelectedIndices.size });
            } else {
                onDragSumChange(null);
            }
        }
    }, [selectedAreaSum, allSelectedIndices, onDragSumChange]);

    React.useEffect(() => {
        if (!onDragSelectionChange) return;
        if (allSelectedIndices.size > 0) {
            const sorted = Array.from(allSelectedIndices).sort((a, b) => a - b);
            onDragSelectionChange(sorted.map((i) => rows[i]?.original).filter(Boolean));
        } else {
            onDragSelectionChange([]);
        }
    }, [allSelectedIndices, rows, onDragSelectionChange]);

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

            // Highlight: drag range OR manual selection
            let isSelectedForSum = false;
            if (dragStart?.col === cell.column.id) {
                if (manualSelection.has(rowIndex)) {
                    isSelectedForSum = true;
                }
                if (dragCurrent) {
                    const minRow = Math.min(dragStart.row, dragCurrent.row);
                    const maxRow = Math.max(dragStart.row, dragCurrent.row);
                    if (rowIndex >= minRow && rowIndex <= maxRow) isSelectedForSum = true;
                }
            }

            return (
                <TableCell
                    key={cell.id}
                    data-row-index={rowIndex}
                    data-column-id={cell.column.id}
                    style={{ width: cell.column.getSize(), ...extraCellStyle }}
                    className={cn(
                        cell.column.columnDef.meta?.cellClassName,
                        enableEditing && !cell.column.columnDef.meta?.editable && "bg-muted",
                        isSelectedForSum && DRAG_SUM_HIGHLIGHT,
                        isDragSumEnabled && "cursor-cell",
                    )}
                    onMouseDown={(e) => {
                        if (isDragSumEnabled) {
                            if (e.ctrlKey || e.metaKey) {
                                // Ctrl+Click: toggle row
                                setManualSelection((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(rowIndex)) {
                                        next.delete(rowIndex);
                                    } else {
                                        next.add(rowIndex);
                                    }
                                    return next;
                                });
                                anchorRowRef.current = rowIndex;
                                setDragStart(
                                    (prev) => prev ?? { row: rowIndex, col: cell.column.id },
                                );
                                return;
                            }

                            if (e.shiftKey && anchorRowRef.current !== null) {
                                // Shift+Click: range from anchor to current
                                const min = Math.min(anchorRowRef.current, rowIndex);
                                const max = Math.max(anchorRowRef.current, rowIndex);
                                setManualSelection((prev) => {
                                    const next = new Set(prev);
                                    for (let i = min; i <= max; i++) next.add(i);
                                    return next;
                                });
                                setDragStart(
                                    (prev) => prev ?? { row: rowIndex, col: cell.column.id },
                                );
                                return;
                            }

                            // Plain click: clear manual selection, start drag
                            setManualSelection(new Set());
                            anchorRowRef.current = rowIndex;
                            setIsDragging(true);
                            setDragStart({ row: rowIndex, col: cell.column.id });
                            setDragCurrent({ row: rowIndex });
                        } else {
                            setDragStart(null);
                            setDragCurrent(null);
                            setManualSelection(new Set());
                        }
                    }}
                    onMouseEnter={() => {
                        if (isDragging && dragStart) {
                            setDragCurrent({ row: rowIndex });
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

    // Single row (existing behavior)
    const singleNewRow =
        enableNewRow && !enableMultipleNewRows && onNewRowSave ? (
            <DataTableNewRow
                columns={columns}
                onSave={onNewRowSave}
                onChange={onNewRowChange}
                defaultValues={newRowDefaultValues}
                enableRowSelection={enableRowSelection}
            />
        ) : null;

    // Multiple rows (new behavior)
    const multiNewRows =
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
                defaultValuesFactory={(index) =>
                    typeof multiRowDefaultValues === "function"
                        ? multiRowDefaultValues(index)
                        : { ...multiRowDefaultValues }
                }
                onNeedMoreRows={onNeedMoreRows ?? NOOP}
            />
        ) : null;

    const newRows = enableMultipleNewRows ? multiNewRows : singleNewRow;
    const position = enableMultipleNewRows ? multiRowPosition : newRowPosition;

    if (rows.length === 0 && !enableNewRow && !enableMultipleNewRows) {
        return (
            <TableBody className={cn(isDragging && "select-none")}>
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
            <TableBody ref={parentRef} className={cn(isDragging && "select-none")}>
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
        <TableBody className={cn(isDragging && "select-none")}>
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
