import {
    type ColumnDef,
    type ColumnFiltersState,
    type ColumnSizingState,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type RowSelectionState,
    type SortingState,
    useReactTable,
    type VisibilityState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Table, TableHeader, TableRow } from "../ui/table";
import { DataTableBody } from "./data-table-body";
import { DataTableColumnHeader } from "./data-table-header";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableToolbar } from "./data-table-toolbar";
import type { DataTableProps } from "./types";

const VIRTUALIZATION_THRESHOLD = 200;

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
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
        {},
    );
    const [globalFilter, setGlobalFilter] = React.useState("");
    const [paginationState, setPaginationState] = React.useState({
        pageIndex: 0,
        pageSize: defaultPageSize,
    });
    const [isShowAll, setIsShowAll] = React.useState(false);
    const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(
        {},
    );
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

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
                    onCheckedChange={(value) =>
                        table.toggleAllPageRowsSelected(!!value)
                    }
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
            columnSizing,
            ...(pagination && !isShowAll
                ? { pagination: paginationState }
                : {}),
        },
        enableColumnResizing,
        columnResizeMode: "onChange",
        onColumnSizingChange: setColumnSizing,
        onPaginationChange: setPaginationState,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        ...(pagination
            ? { getPaginationRowModel: getPaginationRowModel() }
            : {}),
        ...(enableSorting ? { getSortedRowModel: getSortedRowModel() } : {}),
        ...(enableFiltering || enableGlobalSearch
            ? { getFilteredRowModel: getFilteredRowModel() }
            : {}),
        meta: {
            updateData: (
                rowIndex: number,
                columnId: string,
                value: unknown,
            ) => {
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

    // Flex-like column sizing: distribute remaining container space
    // among columns with meta.flex proportionally (like MUI DataGrid flex)
    React.useLayoutEffect(() => {
        if (!enableColumnResizing || !containerRef.current) return;

        const containerWidth = containerRef.current.clientWidth;
        const cols = table.getAllLeafColumns();

        let fixedTotal = 0;
        let flexTotal = 0;

        for (const col of cols) {
            const flex = col.columnDef.meta?.flex;
            if (flex) {
                fixedTotal += col.columnDef.size ?? 150;
                flexTotal += flex;
            } else {
                fixedTotal += col.columnDef.size ?? 150;
            }
        }

        const extraSpace = containerWidth - fixedTotal;
        if (flexTotal <= 0 || extraSpace <= 0) return;

        const newSizing: ColumnSizingState = {};
        for (const col of cols) {
            const flex = col.columnDef.meta?.flex;
            if (flex) {
                const baseSize = col.columnDef.size ?? 150;
                newSizing[col.id] = baseSize + (flex / flexTotal) * extraSpace;
            }
        }
        setColumnSizing(newSizing);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enableColumnResizing, allColumns]);

    // Scroll-to-top/bottom button state
    const [isNearBottom, setIsNearBottom] = React.useState(false);
    const [showScrollBtn, setShowScrollBtn] = React.useState(false);

    const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const scrollable = el.scrollHeight - el.clientHeight;
        if (scrollable < 50) {
            setShowScrollBtn(false);
            return;
        }
        setShowScrollBtn(true);
        setIsNearBottom(el.scrollTop > scrollable / 2);
    }, []);

    const scrollToEdge = React.useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        if (isNearBottom) {
            el.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        }
    }, [isNearBottom]);

    const rows = table.getRowModel().rows;
    const isVirtualActive = isShowAll && rows.length > VIRTUALIZATION_THRESHOLD;

    return (
        <div className={cn("w-full flex flex-col min-h-0", className)}>
            <DataTableToolbar
                table={table}
                globalFilter={globalFilter}
                onGlobalFilterChange={setGlobalFilter}
                enableGlobalSearch={enableGlobalSearch}
                enableColumnVisibility={enableColumnVisibility}
                enableFiltering={enableFiltering}
                translations={translations}
            />

            <div className="relative flex-1 min-h-0">
              <div
                ref={(el) => {
                    containerRef.current = el;
                    if (isVirtualActive) scrollContainerRef.current = el;
                }}
                onScroll={handleScroll}
                className="rounded-md border h-full overflow-auto"
                style={
                    isVirtualActive
                        ? {
                              position: "relative",
                          }
                        : undefined
                }
              >
                <Table
                    style={{
                        ...(enableColumnResizing
                            ? {
                                  width: table.getTotalSize(),
                                  tableLayout: "fixed" as const,
                              }
                            : {}),
                        ...(isVirtualActive ? { display: "grid" } : {}),
                    }}
                >
                    <TableHeader
                        className={
                            isVirtualActive ? "bg-background" : undefined
                        }
                        style={
                            isVirtualActive
                                ? {
                                      display: "grid",
                                      position: "sticky",
                                      top: 0,
                                      zIndex: 1,
                                  }
                                : undefined
                        }
                    >
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow
                                key={headerGroup.id}
                                style={
                                    isVirtualActive
                                        ? { display: "flex", width: "100%" }
                                        : undefined
                                }
                            >
                                {headerGroup.headers.map((header) => (
                                    <DataTableColumnHeader
                                        key={header.id}
                                        header={header}
                                        enableSorting={enableSorting}
                                        enableColumnResizing={
                                            enableColumnResizing
                                        }
                                        isVirtualActive={isVirtualActive}
                                    />
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>

                    <DataTableBody
                        table={table}
                        columns={allColumns}
                        isShowAll={isShowAll}
                        isVirtualActive={isVirtualActive}
                        scrollContainerRef={scrollContainerRef}
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

              <AnimatePresence>
                {showScrollBtn && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className="absolute bottom-3 right-3 z-10"
                    >
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-full shadow-md bg-background/90 backdrop-blur-sm"
                            onClick={scrollToEdge}
                        >
                            {isNearBottom ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </Button>
                    </motion.div>
                )}
              </AnimatePresence>
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
