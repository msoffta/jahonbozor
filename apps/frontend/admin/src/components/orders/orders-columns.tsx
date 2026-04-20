import { format } from "date-fns";
import { Trash2 } from "lucide-react";

import { Button } from "@jahonbozor/ui";

import { formatCurrency } from "@/lib/format";
import { calcOrderCostprice, calcOrderTotal } from "@/lib/order-totals";

import type { AdminOrderItem } from "@jahonbozor/schemas/src/orders";
import type { AdminProductItem } from "@jahonbozor/schemas/src/products";
import type { AdminUserItem } from "@jahonbozor/schemas/src/users";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";

export interface OrderActions {
    onDelete: (id: number) => void;
    onNavigate?: (id: number) => void;
    onSearchProducts?: (query: string) => Promise<{ label: string; value: string }[]>;
    onSearchClients?: (query: string) => Promise<{ label: string; value: string }[]>;
}

interface OrderColumnsData {
    products: AdminProductItem[];
    users: AdminUserItem[];
}

interface OrderColumnsOptions {
    showItemColumns?: boolean;
    canDelete?: boolean;
    showStaff?: boolean;
}

export function getOrderColumns(
    t: TFunction,
    actions: OrderActions,
    data: OrderColumnsData,
    options?: OrderColumnsOptions,
): ColumnDef<AdminOrderItem, unknown>[] {
    const { showItemColumns = true, canDelete = true, showStaff = false } = options ?? {};
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
        { label: t("payment_debt"), value: "DEBT" },
    ];

    const columns: ColumnDef<AdminOrderItem, unknown>[] = [
        {
            accessorKey: "id",
            header: t("order_id"),
            size: 60,
            meta: { flex: 1, align: "center" as const },
            cell: ({ getValue }) => {
                const id = getValue<number>();
                if (actions.onNavigate) {
                    return (
                        <button
                            type="button"
                            className="text-primary font-medium underline-offset-2 hover:underline"
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
                accessorFn: (row) => row.items[0]?.product?.name ?? "",
                header: t("order_product"),
                size: 250,
                meta: {
                    flex: 1,
                    editable: true,
                    inputType: "combobox" as const,
                    selectOptions: productOptions,
                    editValueAccessor: (row: AdminOrderItem) =>
                        row.items[0]?.productId ? String(row.items[0].productId) : "",
                    resolveLabel: (row: AdminOrderItem) => row.items[0]?.product?.name ?? "",
                    enableDragSum: true,
                    onSearchOptions: actions.onSearchProducts,
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
                            {price ? formatCurrency(price, t("common:sum")) : ""}
                        </span>
                    );
                },
                meta: {
                    flex: 1,
                    align: "left" as const,
                    editable: true,
                    inputType: "currency" as const,
                    skipOnEnter: true,
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
                cell: ({ getValue }) => formatCurrency(getValue<number>(), t("common:sum")),
                meta: {
                    flex: 1,
                    align: "left" as const,
                    enableDragSum: true,
                    editable: true,
                    inputType: "currency" as const,
                    skipOnEnter: true,
                },
            },
        );
    }

    if (!showItemColumns) {
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
                accessorFn: (row) => calcOrderTotal(row.items),
                header: t("order_total"),
                size: 130,
                cell: ({ getValue }) => formatCurrency(getValue<number>(), t("common:sum")),
                meta: { flex: 1, align: "left" as const, enableDragSum: true },
            },
        );
    }

    columns.push(
        {
            accessorKey: "paymentType",
            header: t("order_payment"),
            size: 120,
            cell: ({ getValue }) => t(`payment_${getValue<string>().toLowerCase()}`),
            meta: {
                flex: 1,
                editable: showItemColumns,
                inputType: "select" as const,
                selectOptions: paymentOptions,
                skipOnEnter: true,
                filterVariant: "select" as const,
                filterOptions: paymentOptions,
            },
        },
        {
            id: "user",
            accessorFn: (row) => row.user?.fullname ?? "",
            header: t("order_client"),
            size: 180,
            meta: {
                flex: 1,
                editable: showItemColumns,
                inputType: "combobox" as const,
                selectOptions: userOptions,
                editValueAccessor: (row: AdminOrderItem) => (row.userId ? String(row.userId) : ""),
                skipOnEnter: true,
                onSearchOptions: actions.onSearchClients,
            },
        },
    );

    if (showStaff) {
        columns.push({
            id: "staff",
            accessorFn: (row) => row.staff?.fullname ?? "—",
            header: t("order_staff"),
            size: 140,
            meta: { flex: 1 },
        });
    }

    columns.push(
        {
            accessorKey: "createdAt",
            header: t("order_date"),
            size: 140,
            cell: ({ getValue }) => format(new Date(getValue<Date | string>()), "dd.MM.yyyy HH:mm"),
            meta: { flex: 1 },
        },
        {
            accessorKey: "comment",
            header: t("order_comment"),
            size: 150,
            cell: ({ getValue }) => {
                const comment = getValue<string | null>();
                return comment ? (
                    <span className="text-muted-foreground block truncate text-sm italic">
                        {comment}
                    </span>
                ) : (
                    ""
                );
            },
            meta: {
                flex: 1,
                editable: showItemColumns,
                inputType: "text" as const,
                skipOnEnter: true,
            },
        },
        {
            id: "costprice",
            accessorFn: (row) =>
                showItemColumns
                    ? (row.items[0]?.product?.costprice ?? 0)
                    : calcOrderCostprice(row.items),
            header: t("order_costprice"),
            size: 110,
            cell: ({ getValue }) => {
                const costprice = getValue<number>();
                return (
                    <span className="costprice-value">
                        {costprice ? formatCurrency(costprice, t("common:sum")) : ""}
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
    );

    // Only add actions column if user has delete permission
    if (canDelete) {
        columns.push({
            id: "actions",
            header: t("order_actions"),
            size: 80,
            meta: { flex: 1, align: "center" as const },
            cell: ({ row }) => (
                <div className="inline-flex w-full justify-center transition-transform active:scale-90">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive h-8 w-8"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            actions.onDelete(row.original.id);
                        }}
                        title={t("action_delete")}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        });
    }

    return columns;
}
