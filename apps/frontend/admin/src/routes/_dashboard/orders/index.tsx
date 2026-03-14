import { clientsListQueryOptions } from "@/api/clients.api";
import { ordersListQueryOptions, useDeleteOrder } from "@/api/orders.api";
import { productsListQueryOptions } from "@/api/products.api";
import { getOrderColumns } from "@/components/orders/orders-columns";
import type { DataTableTranslations } from "@jahonbozor/ui";
import {
    Button,
    DataTable,
    DataTableSkeleton,
    DatePicker,
    PageTransition,
} from "@jahonbozor/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth.store";
import { Permission, hasAnyPermission } from "@jahonbozor/schemas";
import { useHasPermission } from "@/hooks/use-permissions";

function ListsPage() {
    const { t } = useTranslation("orders");
    const navigate = useNavigate();
    const [isReady, setIsReady] = useState(false);

    // Permission check for delete action
    const canDelete = useHasPermission(Permission.ORDERS_DELETE);

    useEffect(() => {
        const timer = setTimeout(() => setIsReady(true), 300);
        return () => clearTimeout(timer);
    }, []);

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
                if (confirm(t("common:confirm_delete"))) {
                    deleteOrder.mutate(id);
                }
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
        [t, deleteOrder, navigate],
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

    const translations: DataTableTranslations = {
        search: t("common:search"),
        noResults: t("lists_empty"),
        columns: t("table_columns"),
        rowsPerPage: t("common:per_page"),
        showAll: t("table_show_all"),
        previous: t("table_previous"),
        next: t("table_next"),
        filterAll: t("common:filter_all"),
        filterMin: t("common:filter_min"),
        filterMax: t("common:filter_max"),
        filter: t("common:filter"),
    };

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

            {isLoading ? (
                <DataTableSkeleton columns={8} rows={10} className="flex-1" />
            ) : (
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
            )}
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
