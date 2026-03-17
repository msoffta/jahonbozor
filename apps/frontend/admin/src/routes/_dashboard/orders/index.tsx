import { clientsListQueryOptions } from "@/api/clients.api";
import { ordersListQueryOptions, useDeleteOrder } from "@/api/orders.api";
import { productsListQueryOptions } from "@/api/products.api";
import { getOrderColumns } from "@/components/orders/orders-columns";
import { ConfirmDrawer } from "@/components/shared/confirm-drawer";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { Permission, hasAnyPermission } from "@jahonbozor/schemas";
import {
    AnimatePresence,
    Button,
    DataTable,
    DataTableSkeleton,
    DatePicker,
    motion,
    PageTransition,
} from "@jahonbozor/ui";
import { useAuthStore } from "@/stores/auth.store";
import { useHasPermission } from "@/hooks/use-permissions";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { useDeferredReady } from "@/hooks/use-deferred-ready";

function ListsPage() {
    const { t } = useTranslation("orders");
    const navigate = useNavigate();
    const isReady = useDeferredReady(300);
    const translations = useDataTableTranslations("lists_empty");

    // Permission check for delete action
    const canDelete = useHasPermission(Permission.ORDERS_DELETE);

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

    const todayStart = dayjs().startOf("day").toISOString();
    const todayEnd = dayjs().endOf("day").toISOString();

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
            onStatusChange: (_id: number, _status: string) => {
                // Not used on lists page
            },
            onNavigate: (id: number) => {
                navigate({
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

    const isLoading = isOrdersLoading || isProductsLoading || isClientsLoading || !isReady;

    return (
        <PageTransition className="p-6 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">{t("lists_title")}</h1>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <DatePicker
                            value={dateFrom}
                            onChange={(date) =>
                                setDateFrom(
                                    dayjs(date).startOf("day").toISOString(),
                                )
                            }
                            className="h-8 w-36 text-xs"
                        />
                        <span className="text-muted-foreground text-xs">—</span>
                        <DatePicker
                            value={dateTo}
                            onChange={(date) =>
                                setDateTo(
                                    dayjs(date).endOf("day").toISOString(),
                                )
                            }
                            className="h-8 w-36 text-xs"
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
                    <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <DataTableSkeleton columns={8} rows={10} className="flex-1" />
                    </motion.div>
                ) : (
                    <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-0">
                        <DataTable
                            className="flex-1 costprice-table"
                            columns={columns}
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
