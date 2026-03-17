import { useState, useMemo, useCallback } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Permission, hasPermission, hasAnyPermission } from "@jahonbozor/schemas";
import { AnimatePresence, PageTransition, DataTable, DataTableSkeleton, motion, toast } from "@jahonbozor/ui";
import { useAuthStore } from "@/stores/auth.store";
import { useHasPermission, useHasAnyPermission } from "@/hooks/use-permissions";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { useDeferredReady } from "@/hooks/use-deferred-ready";
import { ordersListQueryOptions, useDeleteOrder, useUpdateOrder, useCreateOrder } from "@/api/orders.api";
import { productsListQueryOptions } from "@/api/products.api";
import { clientsListQueryOptions } from "@/api/clients.api";
import { getOrderColumns } from "@/components/orders/orders-columns";
import { ConfirmDrawer } from "@/components/shared/confirm-drawer";

function OrdersPage() {
    const { t } = useTranslation("orders");
    const [page] = useState(1);
    const navigate = useNavigate();
    const isReady = useDeferredReady(300);
    const translations = useDataTableTranslations("orders_empty");

    // Permission checks for component-level actions
    const canCreate = useHasPermission(Permission.ORDERS_CREATE);
    const canUpdate = useHasAnyPermission([
        Permission.ORDERS_UPDATE_ALL,
        Permission.ORDERS_UPDATE_OWN,
    ]);
    const canDelete = useHasPermission(Permission.ORDERS_DELETE);

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

    const newRowDefaultValues = useMemo(() => ({
        paymentType: "CASH",
        quantity: 1,
    }), []);

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
            setDeleteTargetId(id);
            setDeleteConfirmOpen(true);
        },
        onStatusChange: (id: number, status: "NEW" | "ACCEPTED" | "CANCELLED") => {
            updateOrder.mutate({ id, status });
        },
    }), [updateOrder]);

    const columns = useMemo(() => {
        if (!isReady) return [];
        return getOrderColumns(t, actions, { products, users }, { canDelete });
    }, [t, actions, products, users, isReady, canDelete]);

    const orders = ordersData?.orders ?? [];

    const handleCellEdit = useCallback(
        async (rowIndex: number, columnId: string, value: unknown) => {
            if (columnId === "user" && value === "CREATE_NEW") {
                navigate({ to: "/users", search: { new: true } });
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

            if (body.paymentType === "DEBT" && !order.userId && !body.userId) {
                toast.error(t("error_debt_requires_user"));
                throw new Error("Validation failed");
            }
            if (order.paymentType === "DEBT" && columnId === "user" && body.userId === null) {
                toast.error(t("error_debt_requires_user"));
                throw new Error("Validation failed");
            }

            updateOrder.mutate({ id: order.id, ...body });
        },
        [orders, updateOrder, navigate, t],
    );

    const handleNewRowSave = useCallback(
        async (
            data: Record<string, unknown>,
            _rowId: string,
            linkedId?: unknown,
        ) => {
            if (data.user === "CREATE_NEW") {
                navigate({ to: "/users", search: { new: true } });
                return;
            }

            // If already linked, update any field
            if (linkedId) {
                const body: Record<string, unknown> = {};
                if (data.user !== undefined)
                    body.userId = data.user === "" ? null : Number(data.user);
                if (data.paymentType) body.paymentType = data.paymentType;
                // Note: items update logic would go here if supported by backend

                const existingOrder = orders.find(o => o.id === linkedId);
                const isDebt = body.paymentType === "DEBT" || (existingOrder?.paymentType === "DEBT" && !body.paymentType);
                const hasNoUser = (body.userId === null) || (!body.userId && !existingOrder?.userId);

                if (isDebt && hasNoUser) {
                    toast.error(t("error_debt_requires_user"));
                    throw new Error("Validation failed");
                }

                const result = await updateOrder.mutateAsync({
                    id: linkedId as number,
                    ...body,
                });
                return result?.id;
            }

            // For creation, product is strictly required
            if (!data.product) {
                return; // Wait for product selection
            }

            const paymentType = (data.paymentType as "CASH" | "CREDIT_CARD" | "DEBT") || "CASH";
            if (paymentType === "DEBT" && !data.user) {
                toast.error(t("error_debt_requires_user"));
                throw new Error("Validation failed");
            }

            const productId = Number(data.product);
            const product = products.find((p) => p.id === productId);
            const price = product?.price ?? 0;

            const result = await createOrder.mutateAsync({
                userId: data.user ? Number(data.user) : null,
                paymentType,
                items: [
                    {
                        productId,
                        quantity: Number(data.quantity) || 1,
                        price,
                    },
                ],
            });

            return result?.id;
        },
        [createOrder, updateOrder, navigate, products, orders, t],
    );

    const handleNewRowChange = useCallback(
        (values: Record<string, unknown>, _rowId: string) => {
            const currentQuantity = Number(values.quantity) || 1;

            if (values.product) {
                const productId = Number(values.product);
                const product = products.find((p) => p.id === productId);
                const price = product?.price ?? 0;
                const remaining = product?.remaining ?? 0;
                const costprice = product?.costprice ?? 0;
                const newTotal = price * currentQuantity;

                return {
                    ...values,
                    price,
                    remaining,
                    costprice,
                    quantity: currentQuantity,
                    total: newTotal,
                };
            }

            return values;
        },
        [products],
    );

    const isLoading = isOrdersLoading || isProductsLoading || isClientsLoading || !isReady;

    return (
        <PageTransition className="p-6 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">{t("title")}</h1>
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
                            enableEditing={canUpdate}
                            enableMultipleNewRows={canCreate}
                            multiRowCount={15}
                            onCellEdit={handleCellEdit}
                            onMultiRowSave={handleNewRowSave}
                            onMultiRowChange={handleNewRowChange}
                            multiRowDefaultValues={newRowDefaultValues}
                            translations={translations}
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

export const Route = createFileRoute("/_dashboard/")({
    beforeLoad: async () => {
        const { permissions } = useAuthStore.getState();

        // Check if user has permission to list orders
        const canListOrders = hasAnyPermission(permissions, [
            Permission.ORDERS_LIST_ALL,
            Permission.ORDERS_LIST_OWN,
        ]);

        if (!canListOrders) {
            // Redirect to first accessible page
            if (hasPermission(permissions, Permission.ANALYTICS_VIEW)) {
                throw redirect({ to: "/summary" });
            }
            if (hasPermission(permissions, Permission.PRODUCTS_LIST)) {
                throw redirect({ to: "/products" });
            }
            if (hasPermission(permissions, Permission.USERS_LIST)) {
                throw redirect({ to: "/users" });
            }
            if (hasPermission(permissions, Permission.EXPENSES_LIST)) {
                throw redirect({ to: "/expense" });
            }
            if (hasPermission(permissions, Permission.PRODUCT_HISTORY_LIST)) {
                throw redirect({ to: "/income" });
            }
            // If no permissions at all, redirect to settings
            throw redirect({ to: "/settings" });
        }
    },
    component: OrdersPage,
});
