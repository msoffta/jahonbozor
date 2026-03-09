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
    onStatusChange: (id: number, status: string) => void;
    onNavigate?: (id: number) => void;
}

interface OrderColumnsData {
    products: AdminProductItem[];
    users: AdminUserItem[];
}

export function getOrderColumns(
    t: TFunction,
    actions: OrderActions,
    data: OrderColumnsData,
): ColumnDef<AdminOrderItem, any>[] {
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

    return [
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
        {
            id: "user",
            accessorFn: (row) => row.user?.fullname ?? "—",
            header: t("order_client"),
            size: 180,
            meta: {
                flex: 1.5,
                editable: true,
                inputType: "combobox" as const,
                selectOptions: userOptions,
            },
        },
        {
            id: "product",
            accessorFn: (row) => row.items[0]?.product?.name ?? "—",
            header: t("order_product"),
            size: 200,
            meta: {
                flex: 2,
                editable: true,
                inputType: "combobox" as const,
                selectOptions: productOptions,
            },
        },
        {
            id: "price",
            accessorFn: (row) => row.items[0]?.price ?? 0,
            header: t("order_price"),
            size: 100,
            cell: ({ getValue }) => getValue<number>().toLocaleString(),
            meta: { align: "right" as const },
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
                filterVariant: "select" as const,
                filterOptions: [
                    { label: t("status_new"), value: "NEW" },
                    { label: t("status_accepted"), value: "ACCEPTED" },
                    { label: t("status_cancelled"), value: "CANCELLED" },
                ],
            },
        },
        {
            accessorKey: "paymentType",
            header: t("order_payment"),
            size: 120,
            cell: ({ getValue }) =>
                t(`payment_${getValue<string>().toLowerCase()}`),
            meta: {
                editable: true,
                inputType: "select" as const,
                selectOptions: paymentOptions,
            },
        },
        {
            accessorKey: "createdAt",
            header: t("order_date"),
            size: 140,
            cell: ({ getValue }) =>
                dayjs(getValue<Date | string>()).format("DD.MM.YYYY HH:mm"),
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
    ];
}
