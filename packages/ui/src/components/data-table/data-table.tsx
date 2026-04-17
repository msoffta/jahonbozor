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
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Table, TableHeader, TableRow } from "../ui/table";
import { DataTableBody, type DataTableBodyApi } from "./data-table-body";
import { DataTableColumnHeader } from "./data-table-header";
import { DataTableInfiniteStatus } from "./data-table-infinite-status";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableToolbar } from "./data-table-toolbar";
import { useCellNavigation } from "./use-cell-navigation";

import type { DataTableProps, DataTableRef } from "./types";

const VIRTUALIZATION_THRESHOLD = 200;
/** Default column width when no explicit size is provided */
const DEFAULT_COLUMN_SIZE_PX = 150;
/** Minimum scrollable distance before showing scroll-to-edge button */
const SCROLL_BUTTON_THRESHOLD_PX = 50;
/** Distance from bottom (px) at which infinite scroll triggers next page fetch.
 *  Set high enough to prefetch well before the user sees the end of loaded data,
 *  especially when multi-row new-row inputs sit at the bottom (~540px for 15 rows). */
const INFINITE_SCROLL_THRESHOLD_PX = 2000;

export function DataTable<TData>({
    ref,
    columns,
    data: externalData,
    pagination = false,
    pageSizeOptions,
    defaultPageSize = 10,
    enableShowAll = false,
    manualPagination = false,
    pageCount,
    onPaginationChange: onPaginationChangeProp,
    enableSorting = false,
    enableFiltering = false,
    enableGlobalSearch = false,
    enableColumnResizing = false,
    enableColumnVisibility = false,
    enableRowSelection = false,
    enableEditing = false,
    onCellEdit,
    onRowDelete,
    onRowRestore,
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

    // Infinite scroll
    enableInfiniteScroll = false,
    onFetchNextPage,
    onFetchAllPages,
    hasNextPage,
    isFetchingNextPage,
    totalCount,
    onSearchQueryChange,

    onRowSelectionChange,
    initialColumnVisibility,
    onRowClick,
    onDragSelectionChange,
    dragSumFilter,
    loadingRowIds,
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
    const isServerSearch = !!onSearchQueryChange;

    const serverSearchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleGlobalFilterChange = React.useCallback(
        (value: string) => {
            setGlobalFilter(value);
            if (onSearchQueryChange) {
                if (serverSearchTimerRef.current) clearTimeout(serverSearchTimerRef.current);
                serverSearchTimerRef.current = setTimeout(() => onSearchQueryChange(value), 300);
            }
        },
        [onSearchQueryChange],
    );
    const [paginationState, setPaginationState] = React.useState({
        pageIndex: 0,
        pageSize: defaultPageSize,
    });
    const [isShowAll, setIsShowAll] = React.useState(false);
    const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
    const [dragSumInfo, setDragSumInfo] = React.useState<{
        sum: number;
        count: number;
        excludedSum?: number;
        excludedCount?: number;
    } | null>(null);
    const [containerWidth, setContainerWidth] = React.useState(0);
    // useState (not useRef) so that setting the element triggers a re-render,
    // allowing the virtualizer to pick up the non-null scroll element.
    const [scrollElement, setScrollElement] = React.useState<HTMLDivElement | null>(null);
    const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // ── Multi-row state lives inside DataTableBody (see bodyApiRef wiring
    //    below). Keeping rowStates out of this component prevents a
    //    keystroke in a pending row from rerendering Toolbar, Headers, and
    //    filter Selects. ──
    const bodyApiRef = React.useRef<DataTableBodyApi | null>(null);

    React.useImperativeHandle(
        ref,
        () => ({
            flushPendingRows: () => bodyApiRef.current?.flushPendingRows() ?? Promise.resolve(),
            appendRow: () => bodyApiRef.current?.appendRow() ?? null,
        }),
        [],
    );

    // ── Spreadsheet keyboard navigation ──────────────────────────
    useCellNavigation({
        enabled: !!enableEditing,
        containerRef: containerRef as React.RefObject<HTMLElement | null>,
        onRowDelete,
        onRowRestore,
    });

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

    // Notify parent about pagination changes (server-side pagination)
    React.useEffect(() => {
        if (manualPagination && onPaginationChangeProp) {
            onPaginationChangeProp(paginationState);
        }
    }, [paginationState, manualPagination, onPaginationChangeProp]);

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
            ...(!enableInfiniteScroll && pagination && !isShowAll
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
        ...(enableInfiniteScroll
            ? {}
            : manualPagination
              ? { manualPagination: true, pageCount: pageCount ?? -1 }
              : pagination
                ? { getPaginationRowModel: getPaginationRowModel() }
                : {}),
        ...(enableSorting ? { getSortedRowModel: getSortedRowModel() } : {}),
        ...(enableFiltering || (enableGlobalSearch && !isServerSearch)
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

    // Track container width via ResizeObserver for responsive column sizing
    React.useEffect(() => {
        if (!enableColumnResizing || !containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                setContainerWidth(entry.contentRect.width);
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [enableColumnResizing]);

    // Flex-like column sizing: distribute remaining container space
    // among columns with meta.flex proportionally (like MUI DataGrid flex)
    React.useLayoutEffect(() => {
        if (!enableColumnResizing || containerWidth <= 0) return;

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
    }, [enableColumnResizing, allColumns, containerWidth]);

    // Scroll-to-top/bottom button state
    const [isNearBottom, setIsNearBottom] = React.useState(false);
    const [showScrollBtn, setShowScrollBtn] = React.useState(false);
    const [isScrollingToEnd, setIsScrollingToEnd] = React.useState(false);

    // Throttle scroll work to once per frame. Native scroll fires ~60× per
    // second, and this handler causes parent re-renders via setState — without
    // throttling it would retrigger the full DataTable tree on every tick.
    const scrollRafRef = React.useRef<number | null>(null);
    const handleScroll = React.useCallback(
        (e: React.UIEvent<HTMLDivElement>) => {
            const el = e.currentTarget;
            if (scrollRafRef.current != null) return;
            scrollRafRef.current = requestAnimationFrame(() => {
                scrollRafRef.current = null;
                const scrollable = el.scrollHeight - el.clientHeight;
                if (scrollable < SCROLL_BUTTON_THRESHOLD_PX) {
                    setShowScrollBtn(false);
                    return;
                }
                setShowScrollBtn(true);
                setIsNearBottom(el.scrollTop > scrollable / 2);

                // Infinite scroll: fetch next page when near bottom
                if (enableInfiniteScroll && hasNextPage && !isFetchingNextPage && onFetchNextPage) {
                    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                    if (distanceFromBottom < INFINITE_SCROLL_THRESHOLD_PX) {
                        onFetchNextPage();
                    }
                }
            });
        },
        [enableInfiniteScroll, hasNextPage, isFetchingNextPage, onFetchNextPage],
    );

    React.useEffect(
        () => () => {
            if (scrollRafRef.current != null) {
                cancelAnimationFrame(scrollRafRef.current);
                scrollRafRef.current = null;
            }
        },
        [],
    );

    const scrollToEdge = React.useCallback(async () => {
        const el = containerRef.current;
        if (!el) return;
        if (isNearBottom) {
            el.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            if (onFetchAllPages && hasNextPage) {
                setIsScrollingToEnd(true);
                await onFetchAllPages();
                setIsScrollingToEnd(false);
            }
            requestAnimationFrame(() => {
                const firstNewRow = el.querySelector<HTMLElement>('[data-testid="new-row"]');
                if (firstNewRow) {
                    firstNewRow.scrollIntoView({ block: "start", behavior: "instant" });
                } else {
                    el.scrollTo({ top: el.scrollHeight, behavior: "instant" });
                }
            });
        }
    }, [isNearBottom, onFetchAllPages, hasNextPage]);

    const rows = table.getRowModel().rows;
    const isVirtualActive =
        enableInfiniteScroll || (isShowAll && rows.length > VIRTUALIZATION_THRESHOLD);

    // Infinite scroll: check on mount/data change if container needs more data
    React.useEffect(() => {
        if (!enableInfiniteScroll || !hasNextPage || isFetchingNextPage || !onFetchNextPage) return;
        const el = containerRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom < INFINITE_SCROLL_THRESHOLD_PX) {
            onFetchNextPage();
        }
    }, [enableInfiniteScroll, hasNextPage, isFetchingNextPage, onFetchNextPage, rows.length]);

    return (
        <div className={cn("flex min-h-0 w-full flex-col", className)}>
            <DataTableToolbar
                table={table}
                globalFilter={globalFilter}
                onGlobalFilterChange={handleGlobalFilterChange}
                enableGlobalSearch={enableGlobalSearch}
                enableColumnVisibility={enableColumnVisibility}
                enableFiltering={enableFiltering}
                translations={translations}
            />

            <div className="relative min-h-0 flex-1">
                <div
                    ref={(el) => {
                        containerRef.current = el;
                        scrollContainerRef.current = el;
                        if (el !== scrollElement) setScrollElement(el);
                    }}
                    data-datatable
                    onScroll={handleScroll}
                    className="h-full overflow-auto rounded-md border"
                >
                    {(() => {
                        const tableStyle = enableColumnResizing
                            ? {
                                  width: table.getTotalSize(),
                                  tableLayout: "fixed" as const,
                              }
                            : undefined;

                        const tableChildren = (
                            <>
                                <TableHeader>
                                    {table.getHeaderGroups().map((headerGroup) => (
                                        <TableRow key={headerGroup.id}>
                                            {headerGroup.headers.map((header) => (
                                                <DataTableColumnHeader
                                                    key={header.id}
                                                    header={header}
                                                    enableSorting={enableSorting}
                                                    enableColumnResizing={enableColumnResizing}
                                                    isVirtualActive={false}
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
                                    scrollElement={scrollElement}
                                    enableInfiniteScroll={enableInfiniteScroll}
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
                                    enableMultipleNewRows={enableMultipleNewRows}
                                    multiRowCount={multiRowCount}
                                    multiRowIncrement={multiRowIncrement}
                                    multiRowMaxCount={multiRowMaxCount}
                                    multiRowPosition={multiRowPosition}
                                    multiRowDefaultValues={multiRowDefaultValues}
                                    multiRowValidate={multiRowValidate}
                                    onMultiRowSave={onMultiRowSave}
                                    onMultiRowChange={onMultiRowChange}
                                    bodyApiRef={bodyApiRef}
                                    onDragSumChange={setDragSumInfo}
                                    onDragSelectionChange={onDragSelectionChange}
                                    dragSumFilter={dragSumFilter}
                                    loadingRowIds={loadingRowIds}
                                />
                            </>
                        );

                        // Virtual mode: render <table> directly — the Table component
                        // adds a wrapper <div overflow-auto> that creates a second scroll
                        // container, preventing the virtualizer from tracking scroll correctly.
                        return isVirtualActive ? (
                            <table className="w-full caption-bottom text-sm" style={tableStyle}>
                                {tableChildren}
                            </table>
                        ) : (
                            <Table style={tableStyle}>{tableChildren}</Table>
                        );
                    })()}
                </div>

                {showScrollBtn && (
                    <div className="absolute right-3 bottom-3 z-10">
                        <Button
                            variant="outline"
                            size="icon"
                            className="bg-background/90 h-8 w-8 rounded-full shadow-md backdrop-blur-sm"
                            onClick={scrollToEdge}
                            disabled={isScrollingToEnd}
                        >
                            {isScrollingToEnd ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isNearBottom ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                )}
            </div>

            {(enableInfiniteScroll || dragSumInfo) && (
                <DataTableInfiniteStatus
                    loadedCount={rows.length}
                    totalCount={totalCount}
                    isFetchingNextPage={isFetchingNextPage}
                    hasNextPage={hasNextPage}
                    translations={translations}
                    dragSumInfo={dragSumInfo}
                />
            )}

            {pagination && !enableInfiniteScroll && (
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
