import type { AdminProductItem } from "@jahonbozor/schemas/src/products";
import { Button, motion } from "@jahonbozor/ui";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { Trash2 } from "lucide-react";

export interface OrderItemRow {
    id: number;
    productId: number;
    quantity: number;
    price: number;
    product: { id: number; name: string; price?: number; remaining?: number; costprice?: number };
}

export interface OrderItemActions {
    onDelete?: (index: number) => void;
}

export function getOrderItemColumns(
    t: TFunction,
    products: AdminProductItem[],
    actions?: OrderItemActions,
): ColumnDef<OrderItemRow, unknown>[] {
    const selectOptions = products.map((product) => ({
        label: product.name,
        value: String(product.id),
    }));

    const columns: ColumnDef<OrderItemRow, unknown>[] = [
        {
            id: "index",
            header: "#",
            size: 50,
            cell: ({ row }) => row.index + 1,
            meta: { align: "center" as const },
        },
        {
            id: "product",
            accessorFn: (row) => row.product?.name ?? "—",
            header: t("order_product"),
            size: 250,
            meta: {
                flex: 3,
                editable: true,
                inputType: "combobox" as const,
                selectOptions,
            },
        },
        {
            accessorKey: "quantity",
            header: t("order_quantity"),
            size: 100,
            cell: ({ getValue }) => getValue<number>()?.toLocaleString() ?? "—",
            meta: {
                flex: 1,
                align: "left" as const,
                editable: true,
                inputType: "number" as const,
            },
        },
        {
            accessorKey: "price",
            header: t("order_price"),
            size: 100,
            cell: ({ getValue }) => {
                const price = getValue<number>();
                return (
                    <span className="font-medium">
                        {price ? price.toLocaleString() : "—"}
                    </span>
                );
            },
            meta: {
                flex: 1,
                align: "left" as const,
            },
        },
        {
            id: "remaining",
            accessorFn: (row) => row.product?.remaining ?? 0,
            header: t("order_remaining"),
            size: 100,
            cell: ({ getValue }) => getValue<number>().toLocaleString(),
            meta: {
                flex: 1,
                align: "left" as const,
            },
        },
        {
            id: "total",
            header: t("order_total"),
            size: 120,
            accessorFn: (row) => row.price * row.quantity,
            cell: ({ getValue }) => getValue<number>().toLocaleString(),
            meta: {
                flex: 1,
                align: "left" as const,
            },
        },
        {
            id: "costprice",
            accessorFn: (row) => row.product?.costprice ?? 0,
            header: t("order_costprice"),
            size: 100,
            cell: ({ getValue }) => {
                const costprice = getValue<number>();
                return (
                    <span className="costprice-value">
                        {costprice ? costprice.toLocaleString() : "—"}
                    </span>
                );
            },
            meta: {
                flex: 1,
                align: "left" as const,
                cellClassName: "costprice-hover-target",
                headerClassName: "costprice-hover-target",
                className: "costprice-hover-target",
            },
        },
    ];

    if (actions?.onDelete) {
        columns.push({
            id: "actions",
            header: t("order_actions"),
            size: 70,
            meta: { align: "center" as const },
            cell: ({ row }) => (
                <motion.div
                    whileTap={{ scale: 0.9 }}
                    className="inline-flex justify-center w-full"
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => actions.onDelete!(row.index)}
                        title={t("action_delete")}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </motion.div>
            ),
        });
    }

    return columns;
}
