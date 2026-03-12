import type { AdminOrderItem } from "@jahonbozor/schemas/src/orders";
import type { AdminProductItem } from "@jahonbozor/schemas/src/products";
import type { AdminUserItem } from "@jahonbozor/schemas/src/users";
import { Badge, Button, motion } from "@jahonbozor/ui";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import type { TFunction } from "i18next";
import { Trash2 } from "lucide-react";

export interface OrderActions {
    onDelete: (id: number) => void;
    onStatusChange: (id: number, status: "NEW" | "ACCEPTED" | "CANCELLED") => void;
    onNavigate?: (id: number) => void;
}

interface OrderColumnsData {
    products: AdminProductItem[];
    users: AdminUserItem[];
}

interface OrderColumnsOptions {
    showItemColumns?: boolean;
}

export function getOrderColumns(
    t: TFunction,
    actions: OrderActions,
    data: OrderColumnsData,
    options?: OrderColumnsOptions,
): ColumnDef<AdminOrderItem, any>[] {
    const { showItemColumns = true } = options ?? {};
    const productOptions = data.products.map((p) => ({
        label: p.name,
        value: String(p.id),
    }));

    const userOptions = [
        { label: `+ ${t("create_new_client_short")}`, value: "CREATE_NEW" },
        ...data.users.map((u) => ({
            label: u.fullname,
            value: String(u.id),
        })),
    ];

    const paymentOptions = [
        { label: t("payment_cash"), value: "CASH" },
        { label: t("payment_credit_card"), value: "CREDIT_CARD" },
    ];

    const columns: ColumnDef<AdminOrderItem, any>[] = [
        {
            accessorKey: "id",
            header: t("order_id"),
            size: 60,
            meta: { align: "center" as const },
            cell: ({ getValue }) => {
                const id = getValue<number>();
                if (actions.onNavigate) {
                    return (
                        <button
                            type="button"
                            className="font-medium text-primary underline-offset-2 hover:underline"
                            onClick={() => actions.onNavigate!(id)}
                        >
                            {id}
                        </button>
                    );
                }
                return id;
            },
        },
    ];

    if (showItemColumns) {
        columns.push(
            {
                id: "product",
                accessorFn: (row) => row.items[0]?.product?.name ?? "—",
                header: t("order_product"),
                size: 250,
                meta: {
                    flex: 3,
                    editable: true,
                    inputType: "combobox" as const,
                    selectOptions: productOptions,
                },
            },
            {
                id: "quantity",
                accessorFn: (row) => row.items[0]?.quantity ?? 0,
                header: t("order_quantity"),
                size: 110,
                cell: ({ getValue }) => getValue<number>().toLocaleString(),
                meta: {
                    flex: 1,
                    align: "left" as const,
                    editable: true,
                    inputType: "number" as const,
                },
            },
            {
                id: "price",
                accessorFn: (row) => row.items[0]?.price ?? 0,
                header: t("order_price"),
                size: 110,
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
                accessorFn: (row) => row.items[0]?.product?.remaining ?? 0,
                header: t("order_remaining"),
                size: 110,
                cell: ({ getValue }) => getValue<number>().toLocaleString(),
                meta: {
                    flex: 1,
                    align: "left" as const,
                },
            },
            {
                id: "total",
                accessorFn: (row) => {
                    const item = row.items[0];
                    if (!item) return 0;
                    return (item.price ?? 0) * (item.quantity ?? 1);
                },
                header: t("order_total"),
                size: 130,
                cell: ({ getValue }) => getValue<number>().toLocaleString(),
                meta: {
                    flex: 1.5,
                    align: "left" as const,
                },
            },
        );
    } else {
        columns.push(
            {
                id: "itemsCount",
                accessorFn: (row) => row.items.length,
                header: t("order_products_count"),
                size: 100,
                cell: ({ getValue }) => getValue<number>(),
                meta: { flex: 1, align: "center" as const },
            },
            {
                id: "total",
                accessorFn: (row) =>
                    row.items.reduce(
                        (sum, item) => sum + (item.price ?? 0) * (item.quantity ?? 1),
                        0,
                    ),
                header: t("order_total"),
                size: 130,
                cell: ({ getValue }) => getValue<number>().toLocaleString(),
                meta: { flex: 1.5, align: "left" as const },
            },
        );
    }

    columns.push(
        {
            accessorKey: "paymentType",
            header: t("order_payment"),
            size: 120,
            cell: ({ getValue }) =>
                t(`payment_${getValue<string>().toLowerCase()}`),
            meta: {
                flex: 1,
                editable: showItemColumns,
                inputType: "select" as const,
                selectOptions: paymentOptions,
            },
        },
        {
            id: "user",
            accessorFn: (row) => row.user?.fullname ?? "—",
            header: t("order_client"),
            size: 180,
            meta: {
                flex: 1.5,
                editable: showItemColumns,
                inputType: "combobox" as const,
                selectOptions: userOptions,
            },
        },
        {
            accessorKey: "status",
            header: t("order_status"),
            size: 120,
            cell: ({ row }) => {
                const status = row.original.status;
                const variant =
                    status === "ACCEPTED"
                        ? "default"
                        : status === "CANCELLED"
                          ? "destructive"
                          : "outline";
                return (
                    <Badge variant={variant}>
                        {t(`status_${status.toLowerCase()}`)}
                    </Badge>
                );
            },
            meta: {
                flex: 1,
                filterVariant: "select" as const,
                filterOptions: [
                    { label: t("status_new"), value: "NEW" },
                    { label: t("status_accepted"), value: "ACCEPTED" },
                    { label: t("status_cancelled"), value: "CANCELLED" },
                ],
            },
        },
        {
            accessorKey: "createdAt",
            header: t("order_date"),
            size: 140,
            cell: ({ getValue }) =>
                dayjs(getValue<Date | string>()).format("DD.MM.YYYY HH:mm"),
            meta: { flex: 1.5 },
        },
        {
            id: "costprice",
            accessorFn: (row) =>
                showItemColumns
                    ? (row.items[0]?.product?.costprice ?? 0)
                    : row.items.reduce(
                          (sum, item) =>
                              sum +
                              (item.product?.costprice ?? 0) *
                                  (item.quantity ?? 1),
                          0,
                      ),
            header: t("order_costprice"),
            size: 110,
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
        {
            id: "actions",
            header: t("order_actions"),
            size: 80,
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
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            actions.onDelete(row.original.id);
                        }}
                        title={t("action_delete")}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </motion.div>
            ),
        },
    );

    return columns;
}
