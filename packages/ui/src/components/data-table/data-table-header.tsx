import { type Header, flexRender } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import { TableHead } from "../ui/table";

interface DataTableColumnHeaderProps<TData> {
    header: Header<TData, unknown>;
    enableSorting?: boolean;
    enableColumnResizing?: boolean;
    isVirtualActive?: boolean;
}

export function DataTableColumnHeader<TData>({
    header,
    enableSorting,
    enableColumnResizing,
    isVirtualActive,
}: DataTableColumnHeaderProps<TData>) {
    const canSort = enableSorting && header.column.getCanSort();
    const sorted = header.column.getIsSorted();

    const sortIcon =
        sorted === "asc" ? (
            <ArrowUp className="ml-1 h-4 w-4" />
        ) : sorted === "desc" ? (
            <ArrowDown className="ml-1 h-4 w-4" />
        ) : canSort ? (
            <ArrowUpDown className="ml-1 h-4 w-4 opacity-50" />
        ) : null;

    const meta = header.column.columnDef.meta;

    return (
        <TableHead
            key={header.id}
            colSpan={header.colSpan}
            style={{
                width: header.getSize(),
                ...(isVirtualActive
                    ? { display: "flex", alignItems: "center" }
                    : {}),
            }}
            className={cn(
                "relative select-none",
                enableColumnResizing && "group/th",
                meta?.headerClassName,
            )}
        >
            {header.isPlaceholder ? null : canSort ? (
                <motion.button
                    type="button"
                    className="flex items-center font-medium"
                    onClick={header.column.getToggleSortingHandler()}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                    )}
                    {sortIcon}
                </motion.button>
            ) : (
                <div className="flex items-center font-medium">
                    {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                    )}
                </div>
            )}

            {enableColumnResizing && (
                <div
                    onPointerDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    className={cn(
                        "absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none",
                        "opacity-0 group-hover/th:opacity-100 transition-opacity",
                        "after:absolute after:right-0 after:top-0 after:h-full after:w-[2px] after:bg-border",
                        header.column.getIsResizing() &&
                            "opacity-100 after:bg-primary",
                    )}
                    style={{ userSelect: "none" }}
                />
            )}
        </TableHead>
    );
}
