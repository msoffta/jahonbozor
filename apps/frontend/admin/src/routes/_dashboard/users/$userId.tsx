import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowLeft, Banknote, CreditCard, ShoppingCart, Wallet } from "lucide-react";

import { hasPermission, Permission } from "@jahonbozor/schemas";
import {
    AnimatePresence,
    Badge,
    Button,
    DataTable,
    DataTableSkeleton,
    motion,
    PageTransition,
    useIsMobile,
} from "@jahonbozor/ui";

import { clientDetailQueryOptions } from "@/api/clients.api";
import { debtOrdersQueryOptions, debtSummaryQueryOptions } from "@/api/debts.api";
import { ordersListQueryOptions } from "@/api/orders.api";
import { StatCard } from "@/components/analytics/stat-card";
import { PaymentDrawer } from "@/components/debts/payment-drawer";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { useHasPermission } from "@/hooks/use-permissions";
import { formatCurrency } from "@/lib/format";
import { useAuthStore } from "@/stores/auth.store";

import type { AdminOrderItem } from "@jahonbozor/schemas/src/orders";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";

function getSimpleOrderColumns(t: TFunction): ColumnDef<AdminOrderItem, unknown>[] {
    return [
        {
            accessorKey: "id",
            header: t("orders:order_id"),
            size: 60,
            meta: { align: "center" as const },
        },
        {
            accessorKey: "paymentType",
            header: t("orders:order_payment"),
            size: 100,
            cell: ({ getValue }) => {
                const type = getValue<string>();
                return (
                    <Badge variant="secondary">{t(`orders:payment_${type.toLowerCase()}`)}</Badge>
                );
            },
        },
        {
            id: "total",
            header: t("orders:order_total"),
            size: 120,
            accessorFn: (row) =>
                row.items?.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0) ?? 0,
            cell: ({ getValue }) => formatCurrency(getValue<number>(), t("common:sum")),
        },
        {
            id: "itemsCount",
            header: t("orders:order_items_count"),
            size: 80,
            accessorFn: (row) => row.items?.length ?? 0,
            meta: { align: "center" as const },
        },
        {
            accessorKey: "createdAt",
            header: t("orders:order_date"),
            size: 140,
            cell: ({ getValue }) => format(new Date(getValue<Date | string>()), "dd.MM.yyyy HH:mm"),
        },
    ];
}

function UserDetailPage() {
    const { userId } = Route.useParams();
    const { t } = useTranslation("clients");
    const navigate = useNavigate();
    const numericId = Number(userId);
    const orderTranslations = useDataTableTranslations(t("detail_no_orders"));

    const canManageDebts = useHasPermission(Permission.DEBTS_CREATE_PAYMENT);

    const { data: user, isLoading: isUserLoading } = useQuery(clientDetailQueryOptions(numericId));
    const { data: ordersData, isLoading: isOrdersLoading } = useQuery(
        ordersListQueryOptions({ userId: numericId, limit: 100 }),
    );
    const { data: debtSummary } = useQuery(debtSummaryQueryOptions(numericId));
    const { data: debtOrdersData } = useQuery(debtOrdersQueryOptions(numericId));

    const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
    const [paymentOrderId, setPaymentOrderId] = useState(0);
    const [paymentRemaining, setPaymentRemaining] = useState(0);

    const isLoading = isUserLoading || isOrdersLoading;

    const orders = ordersData?.orders ?? [];
    const debtOrders = debtOrdersData?.orders ?? [];

    const orderColumns = useMemo(() => getSimpleOrderColumns(t), [t]);

    const isMobile = useIsMobile();
    const initialColumnVisibility = useMemo(
        (): Record<string, boolean> => (isMobile ? { paymentType: false, itemsCount: false } : {}),
        [isMobile],
    );

    const totalSpent = useMemo(
        () =>
            orders.reduce(
                (sum, order) =>
                    sum +
                    (order.items?.reduce((s, item) => s + Number(item.price) * item.quantity, 0) ??
                        0),
                0,
            ),
        [orders],
    );

    if (isLoading) {
        return (
            <PageTransition className="flex min-h-0 flex-1 flex-col p-3 md:p-6">
                <DataTableSkeleton columns={6} rows={5} className="flex-1" />
            </PageTransition>
        );
    }

    if (!user) {
        return (
            <PageTransition className="p-3 md:p-6">
                <p className="text-muted-foreground">{t("clients_empty")}</p>
            </PageTransition>
        );
    }

    return (
        <PageTransition className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 md:gap-6 md:p-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <motion.button
                        type="button"
                        onClick={() => navigate({ to: "/users" })}
                        className="border-border text-muted-foreground hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                        whileTap={{ scale: 0.9 }}
                        aria-label={t("common:back")}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </motion.button>
                    <div>
                        <h1 className="text-xl font-bold md:text-2xl">{user.fullname}</h1>
                        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                            <span>@{user.username}</span>
                            <span>&middot;</span>
                            <span>{user.phone ?? t("detail_phone_none")}</span>
                            <span className="hidden sm:inline">&middot;</span>
                            <span>
                                {t("detail_registered")}{" "}
                                {format(new Date(user.createdAt), "dd.MM.yyyy")}
                            </span>
                        </div>
                    </div>
                </div>
                <Badge variant={user.deletedAt ? "destructive" : "default"}>
                    {user.deletedAt ? t("status_deleted") : t("status_active")}
                </Badge>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCard
                    title={t("detail_total_orders")}
                    value={orders.length}
                    icon={ShoppingCart}
                    iconColor="text-blue-500"
                />
                <StatCard
                    title={t("detail_total_spent")}
                    value={formatCurrency(totalSpent, t("common:sum"))}
                    icon={Wallet}
                    iconColor="text-emerald-500"
                />
                <StatCard
                    title={t("detail_debt_balance")}
                    value={
                        debtSummary?.balance
                            ? formatCurrency(debtSummary.balance, t("common:sum"))
                            : "0"
                    }
                    icon={CreditCard}
                    iconColor={
                        debtSummary && debtSummary.balance > 0
                            ? "text-destructive"
                            : "text-muted-foreground"
                    }
                />
            </div>

            {/* Debt Section */}
            {debtOrders.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 className="mb-3 text-lg font-semibold">{t("debt_section_title")}</h2>
                    <div className="space-y-2">
                        {debtOrders.map((debtOrder) => (
                            <motion.div
                                key={debtOrder.orderId}
                                className="border-border flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                                whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
                            >
                                <div className="flex items-center gap-4">
                                    <span className="text-muted-foreground text-sm">
                                        #{debtOrder.orderId}
                                    </span>
                                    <div>
                                        <div className="text-sm font-medium">
                                            {t("debt_order_total")}:{" "}
                                            {formatCurrency(debtOrder.orderTotal, t("common:sum"))}
                                        </div>
                                        <div className="text-muted-foreground text-xs">
                                            {t("debt_paid")}:{" "}
                                            {formatCurrency(debtOrder.paidAmount, t("common:sum"))}
                                            {" · "}
                                            {t("debt_remaining")}:{" "}
                                            <span
                                                className={
                                                    debtOrder.remainingAmount > 0
                                                        ? "text-destructive font-medium"
                                                        : "text-emerald-600"
                                                }
                                            >
                                                {formatCurrency(
                                                    debtOrder.remainingAmount,
                                                    t("common:sum"),
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {debtOrder.payments.length > 0 && (
                                        <span className="text-muted-foreground text-xs">
                                            {debtOrder.payments.length}x {t("debt_payment_history")}
                                        </span>
                                    )}
                                    {canManageDebts && debtOrder.remainingAmount > 0 && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setPaymentOrderId(debtOrder.orderId);
                                                setPaymentRemaining(debtOrder.remainingAmount);
                                                setPaymentDrawerOpen(true);
                                            }}
                                        >
                                            <Banknote className="mr-1 h-3 w-3" />
                                            {t("debt_record_payment")}
                                        </Button>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Orders Table */}
            <div className="flex min-h-0 flex-1 flex-col">
                <h2 className="mb-3 text-lg font-semibold">{t("detail_orders")}</h2>
                <AnimatePresence mode="wait">
                    <motion.div
                        key="orders-table"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <DataTable
                            className="flex-1"
                            columns={orderColumns}
                            initialColumnVisibility={initialColumnVisibility}
                            data={orders}
                            pagination
                            defaultPageSize={10}
                            pageSizeOptions={[10, 20, 50]}
                            enableSorting
                            translations={orderTranslations}
                            onRowClick={(row) =>
                                void navigate({
                                    to: "/orders/$orderId",
                                    params: { orderId: String(row.id) },
                                })
                            }
                        />
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Payment Drawer */}
            <PaymentDrawer
                open={paymentDrawerOpen}
                onOpenChange={setPaymentDrawerOpen}
                orderId={paymentOrderId}
                remainingAmount={paymentRemaining}
            />
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/users/$userId")({
    beforeLoad: async () => {
        const { permissions } = useAuthStore.getState();
        if (!hasPermission(permissions, Permission.USERS_READ_ALL)) {
            throw redirect({ to: "/" });
        }
    },
    component: UserDetailPage,
});
