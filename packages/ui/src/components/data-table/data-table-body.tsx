import * as React from "react";
import type { Table as TanStackTable, ColumnDef } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import { TableBody, TableCell, TableRow } from "../ui/table";
import { DataTableEditableCell } from "./data-table-editable-cell";
import { DataTableNewRow } from "./data-table-new-row";

interface DataTableBodyProps<TData> {
    table: TanStackTable<TData>;
    columns: ColumnDef<TData, any>[];
    isShowAll: boolean;
    enableEditing?: boolean;
    onCellEdit?: (rowIndex: number, columnId: string, value: unknown) => void;
    enableNewRow?: boolean;
    newRowPosition?: "start" | "end";
    onNewRowSave?: (data: Record<string, unknown>) => void;
    newRowDefaultValues?: Partial<TData>;
    enableRowSelection?: boolean;
    translations?: { noResults?: string };
}

export function DataTableBody<TData>({
    table,
    columns,
    isShowAll,
    enableEditing,
    onCellEdit,
    enableNewRow,
    newRowPosition = "end",
    onNewRowSave,
    newRowDefaultValues,
    enableRowSelection,
    translations,
}: DataTableBodyProps<TData>) {
    const rows = table.getRowModel().rows;
    const parentRef = React.useRef<HTMLTableSectionElement>(null);

    const virtualizer = useVirtualizer({
        count: isShowAll ? rows.length : 0,
        getScrollElement: () => parentRef.current?.closest(".overflow-auto") as HTMLElement | null,
        estimateSize: () => 40,
        overscan: 20,
        enabled: isShowAll && rows.length > 0,
    });

    const newRow = enableNewRow && onNewRowSave ? (
        <DataTableNewRow
            columns={columns}
            onSave={onNewRowSave}
            defaultValues={newRowDefaultValues}
            enableRowSelection={enableRowSelection}
        />
    ) : null;

    if (rows.length === 0 && !enableNewRow) {
        return (
            <TableBody>
                {newRowPosition === "start" && newRow}
                <TableRow>
                    <TableCell colSpan={columns.length + (enableRowSelection ? 1 : 0)} className="h-24 text-center">
                        {translations?.noResults ?? "No results."}
                    </TableCell>
                </TableRow>
                {newRowPosition === "end" && newRow}
            </TableBody>
        );
    }

    // Virtualized mode when "All" is selected
    if (isShowAll && rows.length > 0) {
        const virtualRows = virtualizer.getVirtualItems();

        return (
            <TableBody ref={parentRef} style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
                {newRowPosition === "start" && newRow}
                {virtualRows.map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    return (
                        <TableRow
                            key={row.id}
                            data-state={row.getIsSelected() ? "selected" : undefined}
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                        >
                            {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                                    {enableEditing && cell.column.columnDef.meta?.editable ? (
                                        <DataTableEditableCell cell={cell.getContext()} enableEditing onCellEdit={onCellEdit} />
                                    ) : (
                                        flexRender(cell.column.columnDef.cell, cell.getContext())
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

    // Paginated mode (default)
    return (
        <TableBody>
            {newRowPosition === "start" && newRow}
            {rows.map((row) => (
                <motion.tr
                    key={row.id}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted")}
                >
                    {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                            {enableEditing && cell.column.columnDef.meta?.editable ? (
                                <DataTableEditableCell cell={cell.getContext()} enableEditing onCellEdit={onCellEdit} />
                            ) : (
                                flexRender(cell.column.columnDef.cell, cell.getContext())
                            )}
                        </TableCell>
                    ))}
                </motion.tr>
            ))}
            {newRowPosition === "end" && newRow}
        </TableBody>
    );
}
