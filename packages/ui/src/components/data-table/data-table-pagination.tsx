import type { Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronsLeft, ChevronsRight } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import type { DataTableTranslations } from "./types";

interface DataTablePaginationProps<TData> {
    table: Table<TData>;
    pageSizeOptions?: number[];
    enableShowAll?: boolean;
    enableRowSelection?: boolean;
    isShowAll: boolean;
    onShowAllChange: (showAll: boolean) => void;
    translations?: DataTableTranslations;
}

export function DataTablePagination<TData>({
    table,
    pageSizeOptions = [10, 20, 30, 50],
    enableShowAll,
    enableRowSelection,
    isShowAll,
    onShowAllChange,
    translations,
}: DataTablePaginationProps<TData>) {
    const tapTransition = { type: "spring" as const, stiffness: 400, damping: 17 };

    return (
        <div className="flex items-center justify-between px-2 py-4">
            {enableRowSelection && (
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredSelectedRowModel().rows.length} / {table.getFilteredRowModel().rows.length}{" "}
                    {translations?.rowsSelected ?? "selected"}
                </div>
            )}

            <div className="flex items-center gap-6 lg:gap-8 ml-auto">
                {/* Page size selector */}
                <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{translations?.rowsPerPage ?? "Rows per page"}</p>
                    <Select
                        value={isShowAll ? "all" : String(table.getState().pagination.pageSize)}
                        onValueChange={(value) => {
                            if (value === "all") {
                                onShowAllChange(true);
                            } else {
                                onShowAllChange(false);
                                table.setPageSize(Number(value));
                            }
                        }}
                    >
                        <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue placeholder={String(table.getState().pagination.pageSize)} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {pageSizeOptions.map((pageSize) => (
                                <SelectItem key={pageSize} value={String(pageSize)}>
                                    {pageSize}
                                </SelectItem>
                            ))}
                            {enableShowAll && (
                                <SelectItem value="all">{translations?.showAll ?? "All"}</SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>

                {/* Page info */}
                {!isShowAll && (
                    <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                        {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                    </div>
                )}

                {/* Navigation */}
                {!isShowAll && (
                    <div className="flex items-center gap-1">
                        <motion.div whileTap={{ scale: 0.95 }} transition={tapTransition}>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => table.setPageIndex(0)}
                                disabled={!table.getCanPreviousPage()}
                                aria-label={translations?.first ?? "First page"}
                            >
                                <ChevronsLeft className="h-4 w-4" />
                            </Button>
                        </motion.div>
                        <motion.div whileTap={{ scale: 0.95 }} transition={tapTransition}>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                                aria-label={translations?.previous ?? "Previous page"}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        </motion.div>
                        <motion.div whileTap={{ scale: 0.95 }} transition={tapTransition}>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                            >
                                <span>→</span>
                            </Button>
                        </motion.div>
                        <motion.div whileTap={{ scale: 0.95 }} transition={tapTransition}>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                                disabled={!table.getCanNextPage()}
                                aria-label={translations?.last ?? "Last page"}
                            >
                                <ChevronsRight className="h-4 w-4" />
                            </Button>
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    );
}
