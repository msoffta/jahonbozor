import * as React from "react";

import { Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Copy } from "lucide-react";

import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

import type { DataTableTranslations } from "./types";
import type { Table } from "@tanstack/react-table";

/** Duration to show "copied" checkmark after clipboard copy */
const COPIED_FEEDBACK_MS = 2000;

interface DataTablePaginationProps<TData> {
    table: Table<TData>;
    pageSizeOptions?: number[];
    enableShowAll?: boolean;
    enableRowSelection?: boolean;
    isShowAll: boolean;
    onShowAllChange: (showAll: boolean) => void;
    translations?: DataTableTranslations;
    dragSumInfo?: {
        sum: number;
        count: number;
        excludedSum?: number;
        excludedCount?: number;
    } | null;
}

export function DataTablePagination<TData>({
    table,
    pageSizeOptions = [10, 20, 30, 50],
    enableShowAll,
    enableRowSelection,
    isShowAll,
    onShowAllChange,
    translations,
    dragSumInfo,
}: DataTablePaginationProps<TData>) {
    const [copied, setCopied] = React.useState(false);

    const handleCopySum = async () => {
        if (!dragSumInfo) return;
        try {
            await navigator.clipboard.writeText(dragSumInfo.sum.toString());
            setCopied(true);
            setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
        } catch {
            // Clipboard API unavailable (e.g. HTTP context)
        }
    };

    return (
        <div className="flex items-center justify-between px-2 py-2">
            <div className="flex flex-1 items-center gap-4">
                {enableRowSelection && (
                    <div className="text-muted-foreground text-sm">
                        {table.getFilteredSelectedRowModel().rows.length} /{" "}
                        {table.getFilteredRowModel().rows.length}{" "}
                        {translations?.rowsSelected ?? "selected"}
                    </div>
                )}

                {dragSumInfo && (
                    <div className="flex items-center gap-2">
                        <div className="bg-muted/30 flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                            <span className="text-muted-foreground">
                                {translations?.sumLabel ?? "Sum"} ({dragSumInfo.count}):
                            </span>
                            <span className="text-foreground font-semibold">
                                {dragSumInfo.sum.toLocaleString()}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="hover:bg-muted ml-1 h-6 w-6"
                                onClick={() => void handleCopySum()}
                            >
                                {copied ? (
                                    <Check className="text-success h-3.5 w-3.5" />
                                ) : (
                                    <Copy className="text-muted-foreground h-3.5 w-3.5" />
                                )}
                            </Button>
                        </div>
                        {dragSumInfo.excludedSum != null && dragSumInfo.excludedSum > 0 && (
                            <div className="border-destructive/30 bg-destructive/5 flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                                <span className="text-muted-foreground">
                                    {translations?.excludedSumLabel ?? "Debt"} (
                                    {dragSumInfo.excludedCount}):
                                </span>
                                <span className="text-destructive font-semibold">
                                    {dragSumInfo.excludedSum.toLocaleString()}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-6 lg:gap-8">
                {/* Page size selector */}
                <div className="flex items-center gap-2">
                    <p className="hidden text-sm font-medium sm:block">
                        {translations?.rowsPerPage ?? "Rows per page"}
                    </p>
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
                        <SelectTrigger className="h-8 w-17.5">
                            <SelectValue
                                placeholder={String(table.getState().pagination.pageSize)}
                            />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {pageSizeOptions.map((pageSize) => (
                                <SelectItem key={pageSize} value={String(pageSize)}>
                                    {pageSize}
                                </SelectItem>
                            ))}
                            {enableShowAll && (
                                <SelectItem value="all">
                                    {translations?.showAll ?? "All"}
                                </SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>

                {/* Page info */}
                {!isShowAll && (
                    <div className="flex w-25 items-center justify-center text-sm font-medium">
                        {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                    </div>
                )}

                {/* Navigation */}
                {!isShowAll && (
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 transition-transform active:scale-95"
                            onClick={() => table.setPageIndex(0)}
                            disabled={!table.getCanPreviousPage()}
                            aria-label={translations?.first ?? "First page"}
                        >
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 transition-transform active:scale-95"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                            aria-label={translations?.previous ?? "Previous page"}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 transition-transform active:scale-95"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                            aria-label={translations?.next ?? "Next page"}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 transition-transform active:scale-95"
                            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                            disabled={!table.getCanNextPage()}
                            aria-label={translations?.last ?? "Last page"}
                        >
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
