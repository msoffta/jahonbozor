import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { endOfDay, startOfDay } from "date-fns";

import { hasAnyPermission, Permission } from "@jahonbozor/schemas";
import {
    AnimatePresence,
    Button,
    DataTable,
    DataTableSkeleton,
    DatePicker,
    motion,
    PageTransition,
    useIsMobile,
} from "@jahonbozor/ui";

import { clientsListQueryOptions } from "@/api/clients.api";
import { ordersListQueryOptions, useDeleteOrder } from "@/api/orders.api";
import { productsListQueryOptions } from "@/api/products.api";
import { getOrderColumns } from "@/components/orders/orders-columns";
import { ConfirmDrawer } from "@/components/shared/confirm-drawer";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { useDeferredReady } from "@/hooks/use-deferred-ready";
import { useHasPermission } from "@/hooks/use-permissions";
import { useAuthStore } from "@/stores/auth.store";

function ListsPage() {
    const { t } = useTranslation("orders");
    const navigate = useNavigate();
    const isReady = useDeferredReady(300);
    const translations = useDataTableTranslations("lists_empty");

    // Permission check for delete action
    const canDelete = useHasPermission(Permission.ORDERS_DELETE);

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

    const todayStart = startOfDay(new Date()).toISOString();
    const todayEnd = endOfDay(new Date()).toISOString();

    const [dateFrom, setDateFrom] = useState(todayStart);
    const [dateTo, setDateTo] = useState(todayEnd);

    const { data: ordersData, isLoading: isOrdersLoading } = useQuery(
        ordersListQueryOptions({
            limit: 100,
            minItemsCount: 2,
            dateFrom,
            dateTo,
        }),
    );

    const { data: productsData, isLoading: isProductsLoading } = useQuery(
        productsListQueryOptions({ limit: 100, includeDeleted: false }),
    );

    const { data: clientsData, isLoading: isClientsLoading } = useQuery(
        clientsListQueryOptions({ limit: 100, includeDeleted: false }),
    );

    const deleteOrder = useDeleteOrder();

    const products = productsData?.products ?? [];
    const users = clientsData?.users ?? [];
    const orders = ordersData?.orders ?? [];

    const actions = useMemo(
        () => ({
            onDelete: (id: number) => {
                setDeleteTargetId(id);
                setDeleteConfirmOpen(true);
            },
            onNavigate: (id: number) => {
                void navigate({
                    to: "/orders/$orderId",
                    params: { orderId: String(id) },
                });
            },
        }),
        [navigate],
    );

    const columns = useMemo(() => {
        if (!isReady) return [];
        return getOrderColumns(
            t,
            actions,
            { products, users },
            { showItemColumns: false, canDelete },
        );
    }, [t, actions, products, users, isReady, canDelete]);

    const isMobile = useIsMobile();
    const initialColumnVisibility = useMemo(
        (): Record<string, boolean> =>
            isMobile ? { paymentType: false, user: false, costprice: false, comment: false } : {},
        [isMobile],
    );

    const isLoading = isOrdersLoading || isProductsLoading || isClientsLoading || !isReady;

    return (
        <PageTransition className="flex min-h-0 flex-1 flex-col p-3 md:p-6">
            <div className="mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-center md:justify-between">
                <h1 className="text-xl font-bold md:text-2xl">{t("lists_title")}</h1>

                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                    <div className="flex items-center gap-2">
                        <DatePicker
                            value={dateFrom}
                            onChange={(date) => {
                                if (date) setDateFrom(startOfDay(new Date(date)).toISOString());
                            }}
                            className="h-8 w-28 text-xs sm:w-36"
                        />
                        <span className="text-muted-foreground text-xs">—</span>
                        <DatePicker
                            value={dateTo}
                            onChange={(date) => {
                                if (date) setDateTo(endOfDay(new Date(date)).toISOString());
                            }}
                            className="h-8 w-28 text-xs sm:w-36"
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setDateFrom(todayStart);
                            setDateTo(todayEnd);
                        }}
                    >
                        {t("today_orders")}
                    </Button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div
                        key="skeleton"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <DataTableSkeleton columns={8} rows={10} className="flex-1" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="table"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <DataTable
                            className="costprice-table flex-1"
                            columns={columns}
                            initialColumnVisibility={initialColumnVisibility}
                            data={orders}
                            pagination
                            defaultPageSize={20}
                            pageSizeOptions={[10, 20, 50]}
                            enableShowAll
                            enableSorting
                            enableGlobalSearch
                            enableFiltering
                            enableColumnVisibility
                            enableColumnResizing
                            translations={translations}
                            onRowClick={(row) => actions.onNavigate(row.id)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <ConfirmDrawer
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
                onConfirm={() => {
                    if (deleteTargetId !== null) {
                        deleteOrder.mutate(deleteTargetId);
                    }
                }}
                isLoading={deleteOrder.isPending}
            />
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/orders/")({
    beforeLoad: async () => {
        const { permissions } = useAuthStore.getState();
        const canListOrders = hasAnyPermission(permissions, [
            Permission.ORDERS_LIST_ALL,
            Permission.ORDERS_LIST_OWN,
        ]);
        if (!canListOrders) {
            throw redirect({ to: "/" });
        }
    },
    component: ListsPage,
});
