import type { Table } from "@tanstack/react-table";
import { Settings2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import type { DataTableTranslations } from "./types";

interface DataTableToolbarProps<TData> {
    table: Table<TData>;
    globalFilter: string;
    onGlobalFilterChange: (value: string) => void;
    enableGlobalSearch?: boolean;
    enableColumnVisibility?: boolean;
    enableFiltering?: boolean;
    translations?: DataTableTranslations;
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
    const hasToolbar = enableGlobalSearch || enableColumnVisibility || enableFiltering;
    if (!hasToolbar) return null;

    return (
        <div className="flex items-center gap-2 py-4">
            {enableGlobalSearch && (
                <Input
                    placeholder={translations?.search ?? "Search..."}
                    value={globalFilter}
                    onChange={(e) => onGlobalFilterChange(e.target.value)}
                    className="max-w-sm h-9"
                />
            )}

            <AnimatePresence>
                {enableFiltering &&
                    table.getAllColumns().filter((col) => col.columnDef.meta?.filterVariant).map((column) => {
                        const meta = column.columnDef.meta;
                        if (!meta?.filterVariant) return null;

                        if (meta.filterVariant === "select" && meta.filterOptions) {
                            return (
                                <motion.div
                                    key={column.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                >
                                    <select
                                        value={(column.getFilterValue() as string) ?? ""}
                                        onChange={(e) => column.setFilterValue(e.target.value || undefined)}
                                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                                    >
                                        <option value="">All</option>
                                        {meta.filterOptions.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </motion.div>
                            );
                        }

                        if (meta.filterVariant === "range") {
                            const filterValue = (column.getFilterValue() as [number, number]) ?? [undefined, undefined];
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
                                        onChange={(e) => column.setFilterValue((old: [number, number]) => [e.target.value ? Number(e.target.value) : undefined, old?.[1]])}
                                        placeholder="Min"
                                        className="h-9 w-20"
                                    />
                                    <Input
                                        type="number"
                                        value={filterValue[1] ?? ""}
                                        onChange={(e) => column.setFilterValue((old: [number, number]) => [old?.[0], e.target.value ? Number(e.target.value) : undefined])}
                                        placeholder="Max"
                                        className="h-9 w-20"
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
                                    placeholder={`Filter ${column.id}...`}
                                    className="h-9 max-w-[150px]"
                                />
                            </motion.div>
                        );
                    })}
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
                                const header = column.columnDef.header;
                                const label = typeof header === "string" ? header : column.id;
                                return (
                                    <DropdownMenuItem
                                        key={column.id}
                                        onClick={() => column.toggleVisibility(!column.getIsVisible())}
                                    >
                                        <span className={cn("mr-2", column.getIsVisible() ? "opacity-100" : "opacity-30")}>
                                            ✓
                                        </span>
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
