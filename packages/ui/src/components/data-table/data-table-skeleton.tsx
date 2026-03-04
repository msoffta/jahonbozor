import { cn } from "../../lib/utils";
import { Skeleton } from "../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

interface DataTableSkeletonProps {
    columns?: number;
    rows?: number;
    className?: string;
    showToolbar?: boolean;
}

export function DataTableSkeleton({
    columns = 6,
    rows = 10,
    className,
    showToolbar = true,
}: DataTableSkeletonProps) {
    return (
        <div className={cn("w-full flex flex-col min-h-0", className)}>
            {showToolbar && (
                <div className="flex items-center gap-2 py-4">
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-9 w-32" />
                    <div className="ml-auto">
                        <Skeleton className="h-9 w-28" />
                    </div>
                </div>
            )}
            <div className="rounded-md border flex-1 min-h-0 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {Array.from({ length: columns }).map((_, i) => (
                                <TableHead key={i}>
                                    <Skeleton className="h-4 w-20" />
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: rows }).map((_, rowIdx) => (
                            <TableRow key={rowIdx}>
                                {Array.from({ length: columns }).map((_, colIdx) => (
                                    <TableCell key={colIdx}>
                                        <Skeleton className={cn(
                                            "h-4",
                                            colIdx === 0 ? "w-10" : "w-full max-w-[120px]",
                                        )} />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
