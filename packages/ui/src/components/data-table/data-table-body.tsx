import type { ColumnDef, Table as TanStackTable } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion } from "motion/react";
import * as React from "react";
import { cn } from "../../lib/utils";
import { TableBody, TableCell, TableRow } from "../ui/table";
import { DataTableEditableCell } from "./data-table-editable-cell";
import { DataTableNewRow } from "./data-table-new-row";

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

    const newRow =
        enableNewRow && onNewRowSave ? (
            <DataTableNewRow
                columns={columns}
                onSave={onNewRowSave}
                onChange={onNewRowChange}
                defaultValues={newRowDefaultValues}
                enableRowSelection={enableRowSelection}
            />
        ) : null;

    if (rows.length === 0 && !enableNewRow) {
        return (
            <TableBody>
                {newRowPosition === "start" && newRow}
                <TableRow>
                    <TableCell
                        colSpan={columns.length + (enableRowSelection ? 1 : 0)}
                        className="h-24 text-center"
                    >
                        {translations?.noResults ?? "No results."}
                    </TableCell>
                </TableRow>
                {newRowPosition === "end" && newRow}
            </TableBody>
        );
    }

    // Virtualized mode (large dataset with "All" selected)
    if (isVirtualActive) {
        const virtualRows = virtualizer.getVirtualItems();

        return (
            <TableBody
                ref={parentRef}
                style={{
                    display: "grid",
                    height: `${virtualizer.getTotalSize()}px`,
                    position: "relative",
                }}
            >
                {newRowPosition === "start" && newRow}
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
                            {row.getVisibleCells().map((cell) => (
                                <TableCell
                                    key={cell.id}
                                    style={{
                                        display: "flex",
                                        width: cell.column.getSize(),
                                    }}
                                    className={
                                        cell.column.columnDef.meta
                                            ?.cellClassName
                                    }
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
                            ))}
                        </TableRow>
                    );
                })}
                {newRowPosition === "end" && newRow}
            </TableBody>
        );
    }

    // Show All with small dataset — render all rows without virtualization
    if (isShowAll && rows.length > 0) {
        return (
            <TableBody>
                {newRowPosition === "start" && newRow}
                {rows.map((row) => (
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
                        {row.getVisibleCells().map((cell) => (
                            <TableCell
                                key={cell.id}
                                style={{ width: cell.column.getSize() }}
                                className={
                                    cell.column.columnDef.meta?.cellClassName
                                }
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
                        ))}
                    </motion.tr>
                ))}
                {newRowPosition === "end" && newRow}
            </TableBody>
        );
    }

    // Paginated mode (default)
    return (
        <TableBody>
            {newRowPosition === "start" && newRow}
            {rows.map((row) => (
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
                    {row.getVisibleCells().map((cell) => (
                        <TableCell
                            key={cell.id}
                            style={{ width: cell.column.getSize() }}
                            className={
                                cell.column.columnDef.meta?.cellClassName
                            }
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
                    ))}
                </motion.tr>
            ))}
            {newRowPosition === "end" && newRow}
        </TableBody>
    );
}
