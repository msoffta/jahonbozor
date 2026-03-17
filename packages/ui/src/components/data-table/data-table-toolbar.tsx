import { Check, Settings2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

import type { DataTableTranslations } from "./types";
import type { Column, Table } from "@tanstack/react-table";

interface DataTableToolbarProps<TData> {
    table: Table<TData>;
    globalFilter: string;
    onGlobalFilterChange: (value: string) => void;
    enableGlobalSearch?: boolean;
    enableColumnVisibility?: boolean;
    enableFiltering?: boolean;
    translations?: DataTableTranslations;
}

function getColumnLabel<TData>(column: Column<TData, unknown>): string {
    const header = column.columnDef.header;
    return typeof header === "string" ? header : column.id;
}

export function DataTableToolbar<TData>({
    table,
    globalFilter,
    onGlobalFilterChange,
    enableGlobalSearch,
    enableColumnVisibility,
    enableFiltering,
    translations,
}: DataTableToolbarProps<TData>) {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- boolean OR logic, not nullish coalescing
    const hasToolbar = enableGlobalSearch || enableColumnVisibility || enableFiltering;
    if (!hasToolbar) return null;

    const filterColumns = enableFiltering
        ? table.getAllColumns().filter((col) => col.columnDef.meta?.filterVariant)
        : [];

    const hasActiveFilters = filterColumns.some((col) => col.getFilterValue() !== undefined);

    return (
        <div className="flex items-center gap-2 py-4">
            {enableGlobalSearch && (
                <Input
                    placeholder={translations?.search ?? "Search..."}
                    value={globalFilter}
                    onChange={(e) => onGlobalFilterChange(e.target.value)}
                    className="h-9 max-w-sm"
                />
            )}

            <AnimatePresence>
                {filterColumns.map((column) => {
                    const meta = column.columnDef.meta;
                    if (!meta?.filterVariant) return null;
                    const label = getColumnLabel(column);

                    if (meta.filterVariant === "select" && meta.filterOptions) {
                        const currentValue = (column.getFilterValue() as string) ?? "";
                        return (
                            <motion.div
                                key={column.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            >
                                <Select
                                    value={currentValue || "__all__"}
                                    onValueChange={(value) =>
                                        column.setFilterValue(
                                            value === "__all__" ? undefined : value,
                                        )
                                    }
                                >
                                    <SelectTrigger className="h-9 min-w-[130px]">
                                        <SelectValue placeholder={label} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__all__">
                                            {label}: {translations?.filterAll ?? "All"}
                                        </SelectItem>
                                        {meta.filterOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </motion.div>
                        );
                    }

                    if (meta.filterVariant === "range") {
                        const filterValue = (column.getFilterValue() as [number, number]) ?? [
                            undefined,
                            undefined,
                        ];
                        return (
                            <motion.div
                                key={column.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="flex items-center gap-1"
                            >
                                <Input
                                    type="number"
                                    value={filterValue[0] ?? ""}
                                    onChange={(e) =>
                                        column.setFilterValue((old: [number, number]) => [
                                            e.target.value ? Number(e.target.value) : undefined,
                                            old?.[1],
                                        ])
                                    }
                                    placeholder={`${label} ${translations?.filterMin ?? "min"}`}
                                    className="h-9 w-24"
                                />
                                <span className="text-muted-foreground text-sm">–</span>
                                <Input
                                    type="number"
                                    value={filterValue[1] ?? ""}
                                    onChange={(e) =>
                                        column.setFilterValue((old: [number, number]) => [
                                            old?.[0],
                                            e.target.value ? Number(e.target.value) : undefined,
                                        ])
                                    }
                                    placeholder={translations?.filterMax ?? "max"}
                                    className="h-9 w-24"
                                />
                            </motion.div>
                        );
                    }

                    // Default: text filter
                    return (
                        <motion.div
                            key={column.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <Input
                                value={(column.getFilterValue() as string) ?? ""}
                                onChange={(e) => column.setFilterValue(e.target.value || undefined)}
                                placeholder={`${translations?.filter ?? "Filter"} ${label.toLowerCase()}...`}
                                className="h-9 max-w-[150px]"
                            />
                        </motion.div>
                    );
                })}
            </AnimatePresence>

            <AnimatePresence>
                {hasActiveFilters && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    >
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 px-2"
                            onClick={() => {
                                for (const col of filterColumns) {
                                    col.setFilterValue(undefined);
                                }
                            }}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            {enableColumnVisibility && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="ml-auto h-9">
                            <Settings2 className="mr-2 h-4 w-4" />
                            {translations?.columns ?? "Columns"}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{translations?.columns ?? "Columns"}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {table
                            .getAllColumns()
                            .filter((column) => column.getCanHide())
                            .map((column) => {
                                const label = getColumnLabel(column);
                                return (
                                    <DropdownMenuItem
                                        key={column.id}
                                        onClick={() =>
                                            column.toggleVisibility(!column.getIsVisible())
                                        }
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                column.getIsVisible()
                                                    ? "opacity-100"
                                                    : "opacity-30",
                                            )}
                                        />
                                        {label}
                                    </DropdownMenuItem>
                                );
                            })}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    );
}
