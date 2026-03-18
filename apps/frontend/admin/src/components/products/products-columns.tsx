import { RotateCcw, Trash2 } from "lucide-react";

import { Badge, Button, motion } from "@jahonbozor/ui";

import { formatCurrency } from "@/lib/format";

import type { AdminProductItem } from "@jahonbozor/schemas/src/products";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";

interface CategoryItem {
    id: number;
    name: string;
}

export interface ProductActions {
    onDelete: (id: number) => void;
    onRestore: (id: number) => void;
}

interface ProductColumnsOptions {
    canDelete?: boolean;
}

export function getProductColumns(
    t: TFunction,
    categories: CategoryItem[],
    actions: ProductActions,
    options?: ProductColumnsOptions,
): ColumnDef<AdminProductItem, unknown>[] {
    const { canDelete = true } = options ?? {};
    const filterOptions = categories.map((c) => ({
        label: c.name,
        value: c.name,
    }));
    const selectOptions = categories.map((c) => ({
        label: c.name,
        value: String(c.id),
    }));

    const columns: ColumnDef<AdminProductItem, unknown>[] = [
        {
            accessorKey: "id",
            header: t("product_id"),
            size: 60,
            meta: { align: "center" as const },
        },
        {
            accessorKey: "name",
            header: t("product_name"),
            size: 200,
            meta: { flex: 2, editable: true, inputType: "text" as const },
        },
        {
            accessorKey: "price",
            header: t("product_price"),
            size: 120,
            cell: ({ getValue }) => formatCurrency(getValue<number>(), t("common:sum")),
            meta: {
                flex: 1,
                align: "left" as const,
                editable: true,
                inputType: "currency" as const,
            },
        },
        {
            accessorKey: "costprice",
            header: t("product_costprice"),
            size: 120,
            cell: ({ getValue }) => formatCurrency(getValue<number>(), t("common:sum")),
            meta: {
                flex: 1,
                align: "left" as const,
                editable: true,
                inputType: "currency" as const,
            },
        },
        {
            id: "category",
            accessorFn: (row) => row.category?.name ?? "",
            header: t("product_category"),
            size: 160,
            cell: ({ row }) => {
                const cat = row.original.category;
                if (!cat) return "—";
                return cat.parent ? `${cat.parent.name} / ${cat.name}` : cat.name;
            },
            meta: {
                flex: 1,
                align: "left" as const,
                filterVariant: "select" as const,
                filterOptions,
                editable: true,
                inputType: "combobox" as const,
                selectOptions,
            },
        },
        {
            accessorKey: "remaining",
            header: t("product_remaining"),
            size: 100,
            meta: {
                flex: 1,
                align: "left" as const,
                editable: true,
                inputType: "number" as const,
            },
        },
        {
            id: "status",
            accessorFn: (row) => (row.deletedAt ? "deleted" : "active"),
            header: t("product_status"),
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
            header: t("product_created"),
            size: 140,
            cell: ({ getValue }) => new Date(getValue<Date | string>()).toLocaleDateString(),
        },
    ];

    // Only add actions column if user has delete permission
    if (canDelete) {
        columns.push({
            id: "actions",
            header: t("product_actions"),
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
