import { format } from "date-fns";
import { RotateCcw, Trash2 } from "lucide-react";

import { Badge, Button, motion } from "@jahonbozor/ui";

import { formatCurrency } from "@/lib/format";

import type { ExpenseItem } from "@jahonbozor/schemas/src/expenses";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";

export interface ExpenseActions {
    onDelete: (id: number) => void;
    onRestore: (id: number) => void;
}

interface ExpenseColumnsOptions {
    canDelete?: boolean;
}

export function getExpenseColumns(
    t: TFunction,
    actions: ExpenseActions,
    options?: ExpenseColumnsOptions,
): ColumnDef<ExpenseItem, unknown>[] {
    const { canDelete = true } = options ?? {};

    const columns: ColumnDef<ExpenseItem, unknown>[] = [
        {
            accessorKey: "id",
            header: t("expense_id"),
            size: 60,
            meta: { align: "center" as const },
        },
        {
            accessorKey: "name",
            header: t("expense_name"),
            size: 200,
            meta: { flex: 2, editable: true, inputType: "text" as const },
        },
        {
            accessorKey: "amount",
            header: t("expense_amount"),
            size: 120,
            cell: ({ getValue }) => formatCurrency(getValue<number>(), t("common:sum")),
            meta: {
                flex: 1,
                align: "right" as const,
                editable: true,
                inputType: "currency" as const,
            },
        },
        {
            accessorKey: "description",
            header: t("expense_description"),
            size: 200,
            cell: ({ getValue }) => getValue<string | null>() ?? "—",
            meta: { flex: 2, editable: true, inputType: "text" as const },
        },
        {
            accessorKey: "expenseDate",
            header: t("expense_date"),
            size: 140,
            cell: ({ getValue }) => {
                const val = getValue<Date | string>();
                return val ? format(new Date(val), "dd.MM.yyyy HH:mm") : "—";
            },
            meta: { flex: 1, editable: true, inputType: "datepicker" as const, showTime: true },
        },
        {
            id: "staff",
            accessorFn: (row) => row.staff?.fullname ?? "—",
            header: t("expense_staff"),
            size: 140,
            meta: { flex: 1 },
        },
        {
            id: "status",
            accessorFn: (row) => (row.deletedAt ? "deleted" : "active"),
            header: t("expense_status"),
            size: 100,
            cell: ({ row }) => {
                const isDeleted = row.original.deletedAt !== null;
                return (
                    <Badge variant={isDeleted ? "destructive" : "default"}>
                        {isDeleted ? t("status_deleted") : t("status_active")}
                    </Badge>
                );
            },
            meta: {
                filterVariant: "select" as const,
                filterOptions: [
                    { label: t("status_active"), value: "active" },
                    { label: t("status_deleted"), value: "deleted" },
                ],
            },
        },
        {
            accessorKey: "createdAt",
            header: t("expense_created"),
            size: 140,
            cell: ({ getValue }) => new Date(getValue<Date | string>()).toLocaleDateString(),
        },
    ];

    // Only add actions column if user has delete permission
    if (canDelete) {
        columns.push({
            id: "actions",
            header: t("expense_actions"),
            size: 100,
            meta: { align: "center" as const },
            cell: ({ row }) => {
                const isDeleted = row.original.deletedAt !== null;
                return (
                    <motion.div
                        whileTap={{ scale: 0.9 }}
                        className="inline-flex w-full justify-center"
                    >
                        {isDeleted ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-primary h-8 w-8"
                                onClick={() => actions.onRestore(row.original.id)}
                                title={t("action_restore")}
                            >
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        ) : (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive h-8 w-8"
                                onClick={() => actions.onDelete(row.original.id)}
                                title={t("action_delete")}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </motion.div>
                );
            },
        });
    }

    return columns;
}
