import * as React from "react";

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

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Table, TableHeader, TableRow } from "../ui/table";
import { DataTableBody } from "./data-table-body";
import { DataTableColumnHeader } from "./data-table-header";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableToolbar } from "./data-table-toolbar";
import { useMultiRowState } from "./use-multi-row-state";

import type { DataTableProps, DataTableRef } from "./types";

const VIRTUALIZATION_THRESHOLD = 200;
/** Default column width when no explicit size is provided */
const DEFAULT_COLUMN_SIZE_PX = 150;
/** Minimum scrollable distance before showing scroll-to-edge button */
const SCROLL_BUTTON_THRESHOLD_PX = 50;

export function DataTable<TData>({
    ref,
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
    onNewRowChange,
    newRowDefaultValues,

    // Multi-row feature
    enableMultipleNewRows = false,
    multiRowCount = 15,
    multiRowIncrement = 15,
    multiRowPosition = "end",
    multiRowMaxCount = 100,
    onMultiRowSave,
    onMultiRowChange,
    multiRowDefaultValues,
    multiRowValidate,

    onRowSelectionChange,
    initialColumnVisibility,
    onRowClick,
    className,
    translations,
}: DataTableProps<TData> & { ref?: React.Ref<DataTableRef> }) {
    const [data, setData] = React.useState(externalData);
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
        initialColumnVisibility ?? {},
    );
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [globalFilter, setGlobalFilter] = React.useState("");
    const [paginationState, setPaginationState] = React.useState({
        pageIndex: 0,
        pageSize: defaultPageSize,
    });
    const [isShowAll, setIsShowAll] = React.useState(false);
    const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
    const [dragSumInfo, setDragSumInfo] = React.useState<{ sum: number; count: number } | null>(
        null,
    );
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // ── Multi-row state management ─────────────────────────────
    const multiRow = useMultiRowState({
        enabled: enableMultipleNewRows,
        initialCount: multiRowCount,
        increment: multiRowIncrement,
        maxCount: multiRowMaxCount,
        defaultValues: multiRowDefaultValues as
            | Record<string, unknown>
            | ((index: number) => Record<string, unknown>)
            | undefined,
        validate: multiRowValidate,
        onSave: onMultiRowSave,
        onChange: onMultiRowChange,
    });

    React.useImperativeHandle(
        ref,
        () => ({
            flushPendingRows: multiRow.flushPendingRows,
        }),
        [multiRow.flushPendingRows],
    );

    // Sync external data
    React.useEffect(() => {
        setData(externalData);
    }, [externalData]);

    // Notify parent about row selection changes
    React.useEffect(() => {
        onRowSelectionChange?.(rowSelection);
    }, [rowSelection, onRowSelectionChange]);

    // Add selection column if enabled
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack Table ColumnDef requires `any` for heterogeneous column value types
    const allColumns = React.useMemo<ColumnDef<TData, any>[]>(() => {
        if (!enableRowSelection) return columns;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack Table ColumnDef requires `any`
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
            columnSizing,
            ...(pagination && !isShowAll ? { pagination: paginationState } : {}),
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
        ...(pagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
        ...(enableSorting ? { getSortedRowModel: getSortedRowModel() } : {}),
        ...(enableFiltering || enableGlobalSearch
            ? { getFilteredRowModel: getFilteredRowModel() }
            : {}),
        meta: {
            updateData: (rowIndex: number, columnId: string, value: unknown) => {
                setData((old) =>
                    old.map((row, index) => {
                        if (index === rowIndex) {
                            return { ...old[rowIndex], [columnId]: value };
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
                fixedTotal += col.columnDef.size ?? DEFAULT_COLUMN_SIZE_PX;
                flexTotal += flex;
            } else {
                fixedTotal += col.columnDef.size ?? DEFAULT_COLUMN_SIZE_PX;
            }
        }

        const extraSpace = containerWidth - fixedTotal;
        if (flexTotal <= 0 || extraSpace <= 0) return;

        const newSizing: ColumnSizingState = {};
        for (const col of cols) {
            const flex = col.columnDef.meta?.flex;
            if (flex) {
                const baseSize = col.columnDef.size ?? DEFAULT_COLUMN_SIZE_PX;
                newSizing[col.id] = baseSize + (flex / flexTotal) * extraSpace;
            }
        }
        setColumnSizing(newSizing);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- table object is recreated every render; including it would cause infinite loop
    }, [enableColumnResizing, allColumns]);

    // Scroll-to-top/bottom button state
    const [isNearBottom, setIsNearBottom] = React.useState(false);
    const [showScrollBtn, setShowScrollBtn] = React.useState(false);

    const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const scrollable = el.scrollHeight - el.clientHeight;
        if (scrollable < SCROLL_BUTTON_THRESHOLD_PX) {
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
        <div className={cn("flex min-h-0 w-full flex-col", className)}>
            <DataTableToolbar
                table={table}
                globalFilter={globalFilter}
                onGlobalFilterChange={setGlobalFilter}
                enableGlobalSearch={enableGlobalSearch}
                enableColumnVisibility={enableColumnVisibility}
                enableFiltering={enableFiltering}
                translations={translations}
            />

            <div className="relative min-h-0 flex-1">
                <div
                    ref={(el) => {
                        containerRef.current = el;
                        if (isVirtualActive) scrollContainerRef.current = el;
                    }}
                    onScroll={handleScroll}
                    className="h-full overflow-auto rounded-md border"
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
                            className={isVirtualActive ? "bg-background" : undefined}
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
                                            enableColumnResizing={enableColumnResizing}
                                            isVirtualActive={isVirtualActive}
                                        />
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>

                        <DataTableBody
                            table={table}
                            columns={allColumns}
                            isVirtualActive={isVirtualActive}
                            scrollContainerRef={scrollContainerRef}
                            enableEditing={enableEditing}
                            onCellEdit={onCellEdit}
                            enableNewRow={enableNewRow}
                            newRowPosition={newRowPosition}
                            onNewRowSave={onNewRowSave}
                            onNewRowChange={onNewRowChange}
                            newRowDefaultValues={newRowDefaultValues}
                            enableRowSelection={enableRowSelection}
                            onRowClick={onRowClick}
                            translations={translations}
                            // Multi-row props
                            enableMultipleNewRows={enableMultipleNewRows}
                            multiRowStates={multiRow.rowStates}
                            multiRowPosition={multiRowPosition}
                            onMultiRowChange={multiRow.handleChange}
                            onMultiRowSave={multiRow.handleSave}
                            onMultiRowFocus={multiRow.handleFocus}
                            onMultiRowBlur={multiRow.handleBlur}
                            onMultiRowFocusNext={multiRow.handleFocusNext}
                            onMultiRowSaveAndLoop={multiRow.handleSaveAndLoop}
                            onNeedMoreRows={multiRow.handleNeedMoreRows}
                            multiRowDefaultValues={multiRowDefaultValues}
                            onDragSumChange={setDragSumInfo}
                        />
                    </Table>
                </div>

                <AnimatePresence>
                    {showScrollBtn && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{
                                type: "spring",
                                stiffness: 500,
                                damping: 30,
                            }}
                            className="absolute right-3 bottom-3 z-10"
                        >
                            <Button
                                variant="outline"
                                size="icon"
                                className="bg-background/90 h-8 w-8 rounded-full shadow-md backdrop-blur-sm"
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
                    dragSumInfo={dragSumInfo}
                />
            )}
        </div>
    );
}
