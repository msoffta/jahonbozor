import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { endOfDay, endOfMonth, startOfDay, startOfMonth } from "date-fns";
import { Printer } from "lucide-react";

import { hasAnyPermission, hasPermission, Permission } from "@jahonbozor/schemas";
import {
    AnimatePresence,
    Button,
    DataTable,
    DataTableSkeleton,
    DatePicker,
    motion,
    PageTransition,
    toast,
    useIsMobile,
} from "@jahonbozor/ui";

import { clientsListQueryOptions, searchClientsFn } from "@/api/clients.api";
import {
    ordersInfiniteQueryOptions,
    useCreateOrder,
    useDeleteOrder,
    useRestoreOrder,
    useUpdateOrder,
} from "@/api/orders.api";
import { productsListQueryOptions, searchProductsDetailFn } from "@/api/products.api";
import { OrderReceiptContainer } from "@/components/orders/order-receipt";
import { getOrderColumns } from "@/components/orders/orders-columns";
import { ConfirmDrawer } from "@/components/shared/confirm-drawer";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { useDeferredReady } from "@/hooks/use-deferred-ready";
import { useHasAnyPermission, useHasPermission } from "@/hooks/use-permissions";
import { useAuthStore } from "@/stores/auth.store";

import type { OrderReceiptProps } from "@/components/orders/order-receipt";
import type { AdminOrderItem } from "@jahonbozor/schemas/src/orders";

function OrdersPage() {
    const { t } = useTranslation("orders");
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const isReady = useDeferredReady(300);
    const translations = useDataTableTranslations(t("orders_empty"));

    // Permission checks for component-level actions
    const canCreate = useHasPermission(Permission.ORDERS_CREATE);
    const canUpdate = useHasAnyPermission([
        Permission.ORDERS_UPDATE_ALL,
        Permission.ORDERS_UPDATE_OWN,
    ]);
    const canDelete = useHasPermission(Permission.ORDERS_DELETE);

    const monthStart = startOfMonth(new Date()).toISOString();
    const monthEnd = endOfMonth(new Date()).toISOString();
    const [dateFrom, setDateFrom] = useState(monthStart);
    const [dateTo, setDateTo] = useState(monthEnd);

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
    const [selectedOrders, setSelectedOrders] = useState<AdminOrderItem[]>([]);

    const receipts = useMemo((): OrderReceiptProps[] => {
        if (selectedOrders.length === 0) return [];

        const userIds = new Set(selectedOrders.map((o) => o.userId ?? null));

        if (userIds.size === 1) {
            // Same client → merge all items into one receipt
            const allItems = selectedOrders.flatMap((o) =>
                o.items.map((item) => ({
                    name: item.product?.name ?? "—",
                    quantity: item.quantity,
                    price: item.price,
                })),
            );
            const totalSum = allItems.reduce((s, i) => s + i.price * i.quantity, 0);
            return [
                {
                    clientName: selectedOrders[0]?.user?.fullname,
                    items: allItems,
                    totalSum,
                },
            ];
        }

        // Different clients → one receipt per order
        return selectedOrders.map((order) => ({
            orderId: order.id,
            clientName: order.user?.fullname,
            date: order.createdAt,
            paymentType: order.paymentType,
            comment: order.comment,
            items: order.items.map((item) => ({
                name: item.product?.name ?? "—",
                quantity: item.quantity,
                price: item.price,
            })),
            totalSum: order.items.reduce((s, i) => s + (i.price ?? 0) * (i.quantity ?? 1), 0),
        }));
    }, [selectedOrders]);

    const newRowDefaultValues = useMemo(
        () => ({
            paymentType: "CASH",
        }),
        [],
    );

    const {
        data: ordersData,
        isLoading: isOrdersLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery(
        ordersInfiniteQueryOptions({
            type: "ORDER",
            searchQuery,
            dateFrom,
            dateTo,
        }),
    );

    const { data: productsData, isLoading: isProductsLoading } = useQuery(
        productsListQueryOptions({ limit: 50, includeDeleted: false }),
    );

    const { data: clientsData, isLoading: isClientsLoading } = useQuery(
        clientsListQueryOptions({ limit: 50, includeDeleted: false }),
    );

    const deleteOrder = useDeleteOrder();
    const restoreOrder = useRestoreOrder();
    const updateOrder = useUpdateOrder();
    const createOrder = useCreateOrder();

    const loadingRowIds = useMemo(() => {
        const ids = new Set<number>();
        if (updateOrder.isPending && updateOrder.variables?.id) ids.add(updateOrder.variables.id);
        if (deleteOrder.isPending && deleteOrder.variables) ids.add(deleteOrder.variables);
        return ids;
    }, [
        updateOrder.isPending,
        updateOrder.variables,
        deleteOrder.isPending,
        deleteOrder.variables,
    ]);

    const products = useMemo(() => productsData?.products ?? [], [productsData]);
    const users = useMemo(() => clientsData?.users ?? [], [clientsData]);

    // Cache for products fetched via async search — lets handlers look up price/remaining/costprice
    // for products that aren't in the initial limit-50 list.
    // Map lives inside the useMemo closure to avoid hook-immutability lint rules.
    const asyncProductSearch = useMemo(() => {
        const cache = new Map<number, (typeof products)[number]>();
        return {
            search: async (query: string) => {
                const fullProducts = await searchProductsDetailFn(query);
                for (const product of fullProducts) {
                    cache.set(product.id, product);
                }
                return fullProducts.map((product) => ({
                    label: product.name,
                    value: String(product.id),
                }));
            },
            getProduct: (id: number) => cache.get(id),
        };
    }, []);

    const actions = useMemo(
        () => ({
            onDelete: (id: number) => {
                setDeleteTargetId(id);
                setDeleteConfirmOpen(true);
            },
            onSearchProducts: asyncProductSearch.search,
            onSearchClients: searchClientsFn,
        }),
        [asyncProductSearch],
    );

    const columns = useMemo(() => {
        if (!isReady) return [];
        return getOrderColumns(t, actions, { products, users }, { canDelete, showStaff: true });
    }, [t, actions, products, users, isReady, canDelete]);

    const orders = useMemo(() => ordersData?.pages.flatMap((p) => p.orders) ?? [], [ordersData]);
    const totalCount = ordersData?.pages[0]?.count ?? 0;

    const isMobile = useIsMobile();
    const initialColumnVisibility = useMemo(
        (): Record<string, boolean> =>
            isMobile
                ? {
                      price: false,
                      remaining: false,
                      paymentType: false,
                      user: false,
                      createdAt: false,
                      costprice: false,
                      comment: false,
                  }
                : {},
        [isMobile],
    );

    const handleCellEdit = useCallback(
        async (rowIndex: number, columnId: string, value: unknown) => {
            if (columnId === "user" && value === "CREATE_NEW") {
                void navigate({ to: "/users", search: { new: true } });
                return;
            }

            const order = orders[rowIndex];
            if (!order) return;

            const body: Record<string, unknown> = {};
            if (columnId === "user") {
                body.userId = value === "" ? null : Number(value);
            } else if (columnId === "product") {
                const item = order.items[0];
                if (!item) return;
                const newProductId = Number(value);
                const newProduct =
                    products.find((p) => p.id === newProductId) ??
                    asyncProductSearch.getProduct(newProductId);
                updateOrder.mutate({
                    id: order.id,
                    items: order.items.map((it, i) =>
                        i === 0
                            ? {
                                  productId: newProductId,
                                  quantity: it.quantity,
                                  price: newProduct?.price ?? it.price,
                              }
                            : { productId: it.productId, quantity: it.quantity, price: it.price },
                    ),
                });
                return;
            } else if (columnId === "price" || columnId === "quantity" || columnId === "total") {
                // Price/quantity/total edits require sending items array
                const item = order.items[0];
                if (!item) return;
                let newPrice = item.price;
                let newQuantity = item.quantity;
                if (columnId === "price") newPrice = Number(value) || 0;
                else if (columnId === "quantity") newQuantity = Number(value) || 0;
                else if (columnId === "total") {
                    const newTotal = Number(value) || 0;
                    newPrice = newQuantity > 0 ? Math.round(newTotal / newQuantity) : newTotal;
                }
                updateOrder.mutate({
                    id: order.id,
                    items: order.items.map((it, i) =>
                        i === 0
                            ? { productId: it.productId, quantity: newQuantity, price: newPrice }
                            : { productId: it.productId, quantity: it.quantity, price: it.price },
                    ),
                });
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
        [orders, products, asyncProductSearch, updateOrder, navigate, t],
    );

    const handleNewRowSave = useCallback(
        async (data: Record<string, unknown>, _rowId: string, linkedId?: unknown) => {
            if (data.user === "CREATE_NEW") {
                void navigate({ to: "/users", search: { new: true } });
                return;
            }

            // If already linked, update any field
            if (linkedId) {
                const body: Record<string, unknown> = {};
                if (data.user !== undefined)
                    body.userId = data.user === "" ? null : Number(data.user);
                if (data.paymentType) body.paymentType = data.paymentType;
                // Note: items update logic would go here if supported by backend

                const existingOrder = orders.find((o) => o.id === linkedId);
                const isDebt =
                    body.paymentType === "DEBT" ||
                    (existingOrder?.paymentType === "DEBT" && !body.paymentType);
                const hasNoUser = body.userId === null || (!body.userId && !existingOrder?.userId);

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

            const paymentType = (data.paymentType as "CASH" | "CREDIT_CARD" | "DEBT") || "CASH";
            if (paymentType === "DEBT" && !data.user) {
                toast.error(t("error_debt_requires_user"));
                throw new Error("Validation failed");
            }

            const productId = data.product ? Number(data.product) : null;
            const product =
                productId != null
                    ? (products.find((p) => p.id === productId) ??
                      asyncProductSearch.getProduct(productId))
                    : undefined;
            const price =
                data.price != null && data.price !== ""
                    ? Number(data.price)
                    : (product?.price ?? 0);

            const result = await createOrder.mutateAsync({
                userId: data.user ? Number(data.user) : null,
                paymentType,
                items: [
                    {
                        productId,
                        quantity: Number(data.quantity) || 0,
                        price,
                    },
                ],
            });

            return result?.id;
        },
        [createOrder, updateOrder, navigate, products, asyncProductSearch, orders, t],
    );

    const handleNewRowChange = useCallback(
        (values: Record<string, unknown>, _rowId: string) => {
            const currentQuantity = Number(values.quantity) || 0;
            const userPriceProvided = values.price != null && values.price !== "";
            const userPrice = userPriceProvided ? Number(values.price) : null;

            if (values.product) {
                const productId = Number(values.product);
                const product =
                    products.find((p) => p.id === productId) ??
                    asyncProductSearch.getProduct(productId);
                const price = userPrice ?? product?.price ?? 0;
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

            const price = userPrice ?? 0;
            const newTotal = price * currentQuantity;
            return { ...values, quantity: currentQuantity, total: newTotal };
        },
        [products, asyncProductSearch],
    );

    const isLoading = isOrdersLoading || isProductsLoading || isClientsLoading || !isReady;

    return (
        <PageTransition className="flex min-h-0 flex-1 flex-col p-2 md:p-4">
            <div className="mb-2 flex flex-col gap-3 md:mb-4 md:flex-row md:items-center md:justify-between">
                <h1 className="text-xl font-bold md:text-2xl">{t("title")}</h1>
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
                            setDateFrom(monthStart);
                            setDateTo(monthEnd);
                        }}
                    >
                        {t("common:this_month")}
                    </Button>
                    <AnimatePresence>
                        {selectedOrders.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 30,
                                }}
                            >
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.print()}
                                    className="gap-1.5"
                                >
                                    <Printer className="h-3.5 w-3.5" />
                                    {t("print_receipt")} ({selectedOrders.length})
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
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
                            enableInfiniteScroll
                            onFetchNextPage={fetchNextPage}
                            onFetchAllPages={async () => {
                                let result = await fetchNextPage();
                                while (result.hasNextPage) {
                                    result = await fetchNextPage();
                                }
                            }}
                            hasNextPage={hasNextPage}
                            isFetchingNextPage={isFetchingNextPage}
                            totalCount={totalCount}
                            enableSorting
                            enableGlobalSearch
                            onSearchQueryChange={setSearchQuery}
                            enableFiltering
                            enableColumnVisibility
                            enableColumnResizing
                            enableEditing={canUpdate}
                            enableMultipleNewRows={canCreate}
                            multiRowCount={10}
                            multiRowMaxCount={50}
                            onCellEdit={handleCellEdit}
                            onRowDelete={
                                canDelete
                                    ? (rowIndex) => {
                                          const id = orders[rowIndex].id;
                                          deleteOrder.mutate(id);
                                          return id;
                                      }
                                    : undefined
                            }
                            onRowRestore={
                                canDelete ? (id) => restoreOrder.mutate(id as number) : undefined
                            }
                            onMultiRowSave={handleNewRowSave}
                            onMultiRowChange={handleNewRowChange}
                            multiRowDefaultValues={newRowDefaultValues}
                            translations={translations}
                            onDragSelectionChange={setSelectedOrders}
                            loadingRowIds={loadingRowIds}
                            dragSumFilter={(order) => order.paymentType !== "DEBT"}
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
            <OrderReceiptContainer receipts={receipts} />
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
