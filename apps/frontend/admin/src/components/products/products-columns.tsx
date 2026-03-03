import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import type { AdminProductItem } from "@jahonbozor/schemas/src/products";
import { Badge } from "@jahonbozor/ui";

interface CategoryItem {
    id: number;
    name: string;
}

export function getProductColumns(
    t: TFunction,
    categories: CategoryItem[],
): ColumnDef<AdminProductItem, any>[] {
    const filterOptions = categories.map((c) => ({ label: c.name, value: c.name }));
    const selectOptions = categories.map((c) => ({ label: c.name, value: String(c.id) }));

    return [
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
            cell: ({ getValue }) => getValue<number>().toLocaleString(),
            meta: { flex: 1, align: "right" as const, editable: true, inputType: "number" as const },
        },
        {
            accessorKey: "costprice",
            header: t("product_costprice"),
            size: 120,
            cell: ({ getValue }) => getValue<number>().toLocaleString(),
            meta: { flex: 1, align: "right" as const, editable: true, inputType: "number" as const },
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
                filterVariant: "select" as const,
                filterOptions,
                editable: true,
                inputType: "select" as const,
                selectOptions,
            },
        },
        {
            accessorKey: "remaining",
            header: t("product_remaining"),
            size: 100,
            meta: { flex: 1, align: "right" as const, editable: true, inputType: "number" as const },
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
}
