import type { ColumnDef, Table as TanStackTable } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion } from "motion/react";
import * as React from "react";
import { cn } from "../../lib/utils";
import { TableBody, TableCell, TableRow } from "../ui/table";
import { DataTableEditableCell } from "./data-table-editable-cell";
import { DataTableNewRow } from "./data-table-new-row";
import { DataTableMultiNewRows } from "./data-table-multi-new-rows";
import type { NewRowState } from "./types";

interface DataTableBodyProps<TData> {
    table: TanStackTable<TData>;
    columns: ColumnDef<TData, any>[];
    isShowAll: boolean;
    isVirtualActive?: boolean;
    scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
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
    onMultiRowDelete?: (rowId: string) => void;
    onMultiRowFocus?: (rowId: string) => void;
    onMultiRowBlur?: (rowId: string) => void;
    onMultiRowFocusNext?: (rowId: string) => void;
    onNeedMoreRows?: () => void;
    multiRowDefaultValues?: Partial<TData> | ((index: number) => Partial<TData>);
    onDragSumChange?: (sumInfo: { sum: number; count: number } | null) => void;
}

export function DataTableBody<TData>({
    table,
    columns,
    isShowAll,
    isVirtualActive,
    scrollContainerRef,
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
    onMultiRowDelete,
    onMultiRowFocus,
    onMultiRowBlur,
    onMultiRowFocusNext,
    onNeedMoreRows,
    multiRowDefaultValues,
    onDragSumChange,
}: DataTableBodyProps<TData>) {
    const rows = table.getRowModel().rows;
    const parentRef = React.useRef<HTMLTableSectionElement>(null);

    const virtualizer = useVirtualizer({
        count: isVirtualActive ? rows.length : 0,
        getScrollElement: () => scrollContainerRef?.current ?? null,
        estimateSize: () => 40,
        overscan: 20,
        enabled: !!isVirtualActive,
    });

    const [isDragging, setIsDragging] = React.useState(false);
    const [dragStart, setDragStart] = React.useState<{ row: number; col: string } | null>(null);
    const [dragCurrent, setDragCurrent] = React.useState<{ row: number } | null>(null);

    React.useEffect(() => {
        const handleMouseUp = () => setIsDragging(false);
        window.addEventListener("mouseup", handleMouseUp);
        return () => window.removeEventListener("mouseup", handleMouseUp);
    }, []);

    const selectedAreaSum = React.useMemo(() => {
        if (!dragStart || !dragCurrent) return 0;
        if (dragStart.row === dragCurrent.row) return 0;

        const minRow = Math.min(dragStart.row, dragCurrent.row);
        const maxRow = Math.max(dragStart.row, dragCurrent.row);

        let sum = 0;
        for (let i = minRow; i <= maxRow; i++) {
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
    }, [dragStart, dragCurrent, rows]);

    React.useEffect(() => {
        if (onDragSumChange) {
            if (dragStart && dragCurrent && dragStart.row !== dragCurrent.row && selectedAreaSum > 0) {
                const count = Math.abs(dragStart.row - dragCurrent.row) + 1;
                onDragSumChange({ sum: selectedAreaSum, count });
            } else {
                onDragSumChange(null);
            }
        }
    }, [selectedAreaSum, dragStart, dragCurrent, onDragSumChange]);

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
                onRowDelete={onMultiRowDelete}
                onRowFocus={onMultiRowFocus}
                onRowBlur={onMultiRowBlur}
                onRowFocusNext={onMultiRowFocusNext}
                enableRowSelection={enableRowSelection}
                defaultValuesFactory={(index) =>
                    typeof multiRowDefaultValues === "function"
                        ? multiRowDefaultValues(index)
                        : { ...multiRowDefaultValues }
                }
                onNeedMoreRows={onNeedMoreRows || (() => {})}
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

    // Virtualized mode (large dataset with "All" selected)
    if (isVirtualActive) {
        const virtualRows = virtualizer.getVirtualItems();

        return (
            <TableBody
                ref={parentRef}
                className={cn(isDragging && "select-none")}
                style={{
                    display: "grid",
                    height: `${virtualizer.getTotalSize()}px`,
                    position: "relative",
                }}
            >
                {position === "start" && newRows}
                {virtualRows.map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    return (
                        <TableRow
                            key={row.id}
                            data-state={
                                row.getIsSelected() ? "selected" : undefined
                            }
                            style={{
                                display: "flex",
                                position: "absolute",
                                transform: `translateY(${virtualRow.start}px)`,
                                width: "100%",
                            }}
                            className={cn(onRowClick ? "cursor-pointer" : "")}
                        >
                            {row.getVisibleCells().map((cell) => {
                                const isDragSumEnabled = cell.column.columnDef.meta?.enableDragSum;
                                let isSelectedForSum = false;
                                if (dragStart && dragCurrent && dragStart.col === cell.column.id) {
                                    const minRow = Math.min(dragStart.row, dragCurrent.row);
                                    const maxRow = Math.max(dragStart.row, dragCurrent.row);
                                    isSelectedForSum = virtualRow.index >= minRow && virtualRow.index <= maxRow;
                                }

                                return (
                                <TableCell
                                    key={cell.id}
                                    style={{
                                        display: "flex",
                                        width: cell.column.getSize(),
                                    }}
                                    className={cn(
                                        cell.column.columnDef.meta?.cellClassName,
                                        isSelectedForSum && "bg-[#e8f0fe] shadow-[inset_0_0_0_1px_#1a73e8] dark:bg-[#e8f0fe]/10 dark:shadow-[inset_0_0_0_1px_#8ab4f8]",
                                        isDragSumEnabled && "cursor-cell"
                                    )}
                                    onMouseDown={() => {
                                        if (isDragSumEnabled) {
                                            setIsDragging(true);
                                            setDragStart({ row: virtualRow.index, col: cell.column.id });
                                            setDragCurrent({ row: virtualRow.index });
                                        } else {
                                            setDragStart(null);
                                            setDragCurrent(null);
                                        }
                                    }}
                                    onMouseEnter={() => {
                                        if (isDragging && dragStart) {
                                            setDragCurrent({ row: virtualRow.index });
                                        }
                                    }}
                                >
                                    {enableEditing &&
                                    cell.column.columnDef.meta?.editable ? (
                                        <DataTableEditableCell
                                            cell={cell.getContext()}
                                            enableEditing
                                            onCellEdit={onCellEdit}
                                        />
                                    ) : (
                                        flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext(),
                                        )
                                    )}
                                </TableCell>
                                );
                            })}
                        </TableRow>
                    );
                })}
                {position === "end" && newRows}
            </TableBody>
        );
    }

    // Show All with small dataset — render all rows without virtualization
    if (isShowAll && rows.length > 0) {
        return (
            <TableBody className={cn(isDragging && "select-none")}>
                {position === "start" && newRows}
                {rows.map((row, index) => (
                    <motion.tr
                        key={row.id}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 30,
                        }}
                        data-state={
                            row.getIsSelected() ? "selected" : undefined
                        }
                        className={cn(
                            "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
                            onRowClick ? "cursor-pointer" : "",
                        )}
                        onClick={() => onRowClick?.(row.original)}
                    >
                        {row.getVisibleCells().map((cell) => {
                            const isDragSumEnabled = cell.column.columnDef.meta?.enableDragSum;
                            let isSelectedForSum = false;
                            if (dragStart && dragCurrent && dragStart.col === cell.column.id) {
                                const minRow = Math.min(dragStart.row, dragCurrent.row);
                                const maxRow = Math.max(dragStart.row, dragCurrent.row);
                                isSelectedForSum = index >= minRow && index <= maxRow;
                            }

                            return (
                            <TableCell
                                key={cell.id}
                                style={{ width: cell.column.getSize() }}
                                className={cn(
                                    cell.column.columnDef.meta?.cellClassName,
                                    isSelectedForSum && "bg-[#e8f0fe] shadow-[inset_0_0_0_1px_#1a73e8] dark:bg-[#e8f0fe]/10 dark:shadow-[inset_0_0_0_1px_#8ab4f8]",
                                    isDragSumEnabled && "cursor-cell"
                                )}
                                onMouseDown={() => {
                                    if (isDragSumEnabled) {
                                        setIsDragging(true);
                                        setDragStart({ row: index, col: cell.column.id });
                                        setDragCurrent({ row: index });
                                    } else {
                                        setDragStart(null);
                                        setDragCurrent(null);
                                    }
                                }}
                                onMouseEnter={() => {
                                    if (isDragging && dragStart) {
                                        setDragCurrent({ row: index });
                                    }
                                }}
                            >
                                {enableEditing &&
                                cell.column.columnDef.meta?.editable ? (
                                    <DataTableEditableCell
                                        cell={cell.getContext()}
                                        enableEditing
                                        onCellEdit={onCellEdit}
                                    />
                                ) : (
                                    flexRender(
                                        cell.column.columnDef.cell,
                                        cell.getContext(),
                                    )
                                )}
                            </TableCell>
                            );
                        })}
                    </motion.tr>
                ))}
                {position === "end" && newRows}
            </TableBody>
        );
    }

    // Paginated mode (default)
    return (
        <TableBody className={cn(isDragging && "select-none")}>
            {position === "start" && newRows}
            {rows.map((row, index) => (
                <motion.tr
                    key={row.id}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={cn(
                        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
                        onRowClick ? "cursor-pointer" : "",
                    )}
                    onClick={() => onRowClick?.(row.original)}
                >
                    {row.getVisibleCells().map((cell) => {
                        const isDragSumEnabled = cell.column.columnDef.meta?.enableDragSum;
                        let isSelectedForSum = false;
                        if (dragStart && dragCurrent && dragStart.col === cell.column.id) {
                            const minRow = Math.min(dragStart.row, dragCurrent.row);
                            const maxRow = Math.max(dragStart.row, dragCurrent.row);
                            isSelectedForSum = index >= minRow && index <= maxRow;
                        }

                        return (
                        <TableCell
                            key={cell.id}
                            style={{ width: cell.column.getSize() }}
                            className={cn(
                                cell.column.columnDef.meta?.cellClassName,
                                isSelectedForSum && "bg-[#e8f0fe] shadow-[inset_0_0_0_1px_#1a73e8] dark:bg-[#e8f0fe]/10 dark:shadow-[inset_0_0_0_1px_#8ab4f8]",
                                isDragSumEnabled && "cursor-cell"
                            )}
                            onMouseDown={() => {
                                if (isDragSumEnabled) {
                                    setIsDragging(true);
                                    setDragStart({ row: index, col: cell.column.id });
                                    setDragCurrent({ row: index });
                                } else {
                                    setDragStart(null);
                                    setDragCurrent(null);
                                }
                            }}
                            onMouseEnter={() => {
                                if (isDragging && dragStart) {
                                    setDragCurrent({ row: index });
                                }
                            }}
                        >
                            {enableEditing &&
                            cell.column.columnDef.meta?.editable ? (
                                <DataTableEditableCell
                                    cell={cell.getContext()}
                                    enableEditing
                                    onCellEdit={onCellEdit}
                                />
                            ) : (
                                flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext(),
                                )
                            )}
                        </TableCell>
                        );
                    })}
                </motion.tr>
            ))}
            {position === "end" && newRows}
        </TableBody>
    );
}
