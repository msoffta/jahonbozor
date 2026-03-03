import * as React from "react";
import {
    type ColumnDef,
    type SortingState,
    type ColumnFiltersState,
    type VisibilityState,
    type RowSelectionState,
    useReactTable,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
} from "@tanstack/react-table";
import { cn } from "../../lib/utils";
import { Table, TableHeader, TableRow } from "../ui/table";
import { Checkbox } from "../ui/checkbox";
import { DataTableColumnHeader } from "./data-table-header";
import { DataTableBody } from "./data-table-body";
import { DataTableToolbar } from "./data-table-toolbar";
import { DataTablePagination } from "./data-table-pagination";
import type { DataTableProps } from "./types";

export function DataTable<TData>({
    columns,
    data: externalData,
    pagination = false,
    pageSizeOptions,
    defaultPageSize = 10,
    enableShowAll = false,
    enableSorting = false,
    enableFiltering = false,
    enableGlobalSearch = false,
    enableColumnResizing = false,
    enableColumnVisibility = false,
    enableRowSelection = false,
    enableEditing = false,
    onCellEdit,
    enableNewRow = false,
    newRowPosition = "end",
    onNewRowSave,
    newRowDefaultValues,
    onRowSelectionChange,
    className,
    translations,
}: DataTableProps<TData>) {
    const [data, setData] = React.useState(externalData);
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [globalFilter, setGlobalFilter] = React.useState("");
    const [paginationState, setPaginationState] = React.useState({
        pageIndex: 0,
        pageSize: defaultPageSize,
    });
    const [isShowAll, setIsShowAll] = React.useState(false);

    // Sync external data
    React.useEffect(() => {
        setData(externalData);
    }, [externalData]);

    // Notify parent about row selection changes
    React.useEffect(() => {
        onRowSelectionChange?.(rowSelection);
    }, [rowSelection, onRowSelectionChange]);

    // Add selection column if enabled
    const allColumns = React.useMemo<ColumnDef<TData, any>[]>(() => {
        if (!enableRowSelection) return columns;

        const selectionColumn: ColumnDef<TData, any> = {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
            size: 40,
        };

        return [selectionColumn, ...columns];
    }, [columns, enableRowSelection]);

    const table = useReactTable({
        data,
        columns: allColumns,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
            globalFilter,
            ...(pagination && !isShowAll ? { pagination: paginationState } : {}),
        },
        enableColumnResizing,
        columnResizeMode: "onChange",
        onPaginationChange: setPaginationState,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        ...(pagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
        ...(enableSorting ? { getSortedRowModel: getSortedRowModel() } : {}),
        ...(enableFiltering || enableGlobalSearch ? { getFilteredRowModel: getFilteredRowModel() } : {}),
        meta: {
            updateData: (rowIndex: number, columnId: string, value: unknown) => {
                setData((old) =>
                    old.map((row, index) => {
                        if (index === rowIndex) {
                            return { ...old[rowIndex]!, [columnId]: value };
                        }
                        return row;
                    }),
                );
            },
        },
    });

    return (
        <div className={cn("w-full", className)}>
            <DataTableToolbar
                table={table}
                globalFilter={globalFilter}
                onGlobalFilterChange={setGlobalFilter}
                enableGlobalSearch={enableGlobalSearch}
                enableColumnVisibility={enableColumnVisibility}
                enableFiltering={enableFiltering}
                translations={translations}
            />

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <DataTableColumnHeader
                                        key={header.id}
                                        header={header}
                                        enableSorting={enableSorting}
                                        enableColumnResizing={enableColumnResizing}
                                    />
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>

                    <DataTableBody
                        table={table}
                        columns={allColumns}
                        isShowAll={isShowAll}
                        enableEditing={enableEditing}
                        onCellEdit={onCellEdit}
                        enableNewRow={enableNewRow}
                        newRowPosition={newRowPosition}
                        onNewRowSave={onNewRowSave}
                        newRowDefaultValues={newRowDefaultValues}
                        enableRowSelection={enableRowSelection}
                        translations={translations}
                    />
                </Table>
            </div>

            {pagination && (
                <DataTablePagination
                    table={table}
                    pageSizeOptions={pageSizeOptions}
                    enableShowAll={enableShowAll}
                    enableRowSelection={enableRowSelection}
                    isShowAll={isShowAll}
                    onShowAllChange={setIsShowAll}
                    translations={translations}
                />
            )}
        </div>
    );
}
