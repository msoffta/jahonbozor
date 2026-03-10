import { useState, useMemo, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PageTransition, DataTable, DataTableSkeleton } from "@jahonbozor/ui";
import type { DataTableTranslations } from "@jahonbozor/ui";
import { ordersListQueryOptions, useDeleteOrder, useUpdateOrder, useCreateOrder } from "@/api/orders.api";
import { productsListQueryOptions } from "@/api/products.api";
import { clientsListQueryOptions } from "@/api/clients.api";
import { getOrderColumns } from "@/components/orders/orders-columns";

function OrdersPage() {
    const { t } = useTranslation("orders");
    const [page] = useState(1);
    const navigate = useNavigate();
    const [newRowDefaultValues, setNewRowDefaultValues] = useState<Record<string, unknown>>({
        paymentType: "CASH",
        quantity: 1,
    });

    const { data: ordersData, isLoading: isOrdersLoading } = useQuery(
        ordersListQueryOptions({ 
            page, 
            limit: 20, 
            itemsCount: 1 
        }),
    );

    const { data: productsData, isLoading: isProductsLoading } = useQuery(
        productsListQueryOptions({ limit: 100, includeDeleted: false }),
    );

    const { data: clientsData, isLoading: isClientsLoading } = useQuery(
        clientsListQueryOptions({ limit: 100, includeDeleted: false }),
    );

    const deleteOrder = useDeleteOrder();
    const updateOrder = useUpdateOrder();
    const createOrder = useCreateOrder();

    const products = productsData?.products ?? [];
    const users = clientsData?.users ?? [];

    const actions = useMemo(() => ({
        onDelete: (id: number) => {
            if (confirm(t("common:confirm_delete"))) {
                deleteOrder.mutate(id);
            }
        },
        onStatusChange: (id: number, status: "NEW" | "ACCEPTED" | "CANCELLED") => {
            updateOrder.mutate({ id, status });
        },
    }), [t, deleteOrder, updateOrder]);

    const columns = useMemo(
        () => getOrderColumns(t, actions, { products, users }),
        [t, actions, products, users],
    );

    const orders = ordersData?.orders ?? [];

    const handleCellEdit = useCallback(
        async (rowIndex: number, columnId: string, value: unknown) => {
            if (columnId === "user" && value === "CREATE_NEW") {
                navigate({ to: "/users", search: { new: true } as any });
                return;
            }

            const order = orders[rowIndex];
            if (!order) return;

            const body: Record<string, unknown> = {};
            if (columnId === "user") {
                body.userId = value === "" ? null : Number(value);
            } else if (columnId === "product") {
                return;
            } else {
                body[columnId] = value;
            }

            updateOrder.mutate({ id: order.id, ...body });
        },
        [orders, updateOrder, navigate],
    );

    const handleNewRowSave = useCallback(
        async (data: Record<string, unknown>) => {
            if (data.user === "CREATE_NEW") {
                navigate({ to: "/users", search: { new: true } as any });
                return;
            }

            if (!data.product) {
                alert(t("error_product_required"));
                return;
            }

            const productId = Number(data.product);
            const product = products.find((p) => p.id === productId);
            const price = product?.price ?? 0;

            createOrder.mutate({
                userId: data.user ? Number(data.user) : null,
                paymentType: (data.paymentType as "CASH" | "CREDIT_CARD") || "CASH",
                items: [
                    {
                        productId,
                        quantity: Number(data.quantity) || 1,
                        price,
                    }
                ],
            });
        },
        [createOrder, t, navigate, products],
    );

    const handleNewRowChange = useCallback(
        (values: Record<string, unknown>) => {
            const currentQuantity = Number(values.quantity) || 1;

            if (values.product) {
                const productId = Number(values.product);
                const product = products.find((p) => p.id === productId);
                const price = product?.price ?? 0;
                const newTotal = price * currentQuantity;

                setNewRowDefaultValues((prev) => {
                    if (
                        prev.product !== values.product ||
                        prev.price !== price ||
                        prev.total !== newTotal ||
                        prev.quantity !== currentQuantity
                    ) {
                        return {
                            ...prev,
                            product: values.product,
                            price,
                            quantity: currentQuantity,
                            total: newTotal,
                        };
                    }
                    return prev;
                });
            } else {
                setNewRowDefaultValues((prev) => {
                    if (prev.product !== undefined || prev.price !== undefined) {
                        return {
                            paymentType: "CASH",
                            quantity: 1,
                            product: "",
                            price: "",
                            total: "",
                        };
                    }
                    return prev;
                });
            }
        },
        [products],
    );

    const translations: DataTableTranslations = {
        search: t("common:search"),
        noResults: t("orders_empty"),
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

    const isLoading = isOrdersLoading || isProductsLoading || isClientsLoading;

    return (
        <PageTransition className="p-6 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">{t("title")}</h1>
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
                    enableEditing
                    enableNewRow
                    onCellEdit={handleCellEdit}
                    onNewRowSave={handleNewRowSave}
                    onNewRowChange={handleNewRowChange}
                    newRowDefaultValues={newRowDefaultValues}
                    translations={translations}
                />
            )}
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/")({
    component: OrdersPage,
});
