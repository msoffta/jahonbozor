import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowLeft, Printer, Trash2 } from "lucide-react";

import { hasAnyPermission, Permission } from "@jahonbozor/schemas";
import {
    Badge,
    Button,
    DataTable,
    DataTableSkeleton,
    Input,
    motion,
    PageTransition,
    useIsMobile,
} from "@jahonbozor/ui";

import { orderDetailQueryOptions, useDeleteOrder, useUpdateOrder } from "@/api/orders.api";
import { productsListQueryOptions, searchProductsDetailFn } from "@/api/products.api";
import { getOrderItemColumns } from "@/components/orders/order-items-columns";
import { OrderReceiptContainer } from "@/components/orders/order-receipt";
import { ConfirmDrawer } from "@/components/shared/confirm-drawer";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { useHasPermission } from "@/hooks/use-permissions";
import { formatCurrency } from "@/lib/format";
import { useAuthStore } from "@/stores/auth.store";

function OrderDetailPage() {
    const { orderId } = Route.useParams();
    const { t } = useTranslation("orders");
    const navigate = useNavigate();
    const translations = useDataTableTranslations(t("no_items"));
    const numericId = Number(orderId);

    const canDelete = useHasPermission(Permission.ORDERS_DELETE);
    const canUpdate = useHasPermission(Permission.ORDERS_UPDATE_OWN);

    const { data: order, isLoading } = useQuery(orderDetailQueryOptions(numericId));

    const { data: productsData } = useQuery(
        productsListQueryOptions({ limit: 50, includeDeleted: false }),
    );

    const updateOrder = useUpdateOrder();
    const deleteOrder = useDeleteOrder();
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const commentInputRef = useRef<HTMLInputElement>(null);

    const items = useMemo(() => order?.items ?? [], [order]);
    const products = useMemo(() => {
        const base = productsData?.products ?? [];
        const existingIds = new Set(base.map((product) => product.id));
        const extras = items
            .map((item) => item.product)
            .filter(
                (product): product is NonNullable<typeof product> =>
                    product != null && !existingIds.has(product.id),
            )
            .map((product) => ({
                id: product.id,
                name: product.name,
                price: product.price ?? 0,
                remaining: product.remaining ?? 0,
                costprice: product.costprice ?? 0,
                categoryId: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                staffId: null,
                deletedAt: null,
            }));
        return [...base, ...extras];
    }, [productsData, items]);

    const persistItems = useCallback(
        (
            nextItems: {
                productId: number | null;
                quantity: number;
                price: number;
            }[],
        ) => {
            if (!order) return;
            // Normalize to the API payload shape; callers may pass through
            // enriched item objects (including `id`, `product`, …) so that
            // untouched rows keep their reference identity for memoization.
            const payload = nextItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
            }));
            updateOrder.mutate({ id: order.id, items: payload });
        },
        [order, updateOrder],
    );

    const handleDeleteItem = useCallback(
        (index: number) => {
            // Filter-only keeps untouched item identities stable.
            const nextItems = items.filter((_, i) => i !== index);
            persistItems(nextItems);
        },
        [items, persistItems],
    );

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

    const columns = useMemo(
        () =>
            canUpdate
                ? getOrderItemColumns(t, products, {
                      onDelete: handleDeleteItem,
                      onSearchProducts: asyncProductSearch.search,
                  })
                : getOrderItemColumns(t, products),
        [t, products, canUpdate, handleDeleteItem, asyncProductSearch],
    );

    const isMobile = useIsMobile();
    const initialColumnVisibility = useMemo(
        (): Record<string, boolean> =>
            isMobile ? { price: false, remaining: false, costprice: false } : {},
        [isMobile],
    );

    const newRowDefaultValues = useMemo(() => ({}), []);

    const handleNewRowChange = useCallback(
        (values: Record<string, unknown>, _rowId: string) => {
            const currentQuantity = Number(values.quantity) || 0;
            const userPriceProvided = values.price != null && values.price !== "";
            const userPrice = userPriceProvided ? Number(values.price) : null;

            if (values.product) {
                const productId = Number(values.product);
                const product =
                    products.find((candidate) => candidate.id === productId) ??
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

    const handleNewRowSave = useCallback(
        async (data: Record<string, unknown>, _rowId: string, linkedId?: unknown) => {
            if (!order) return undefined;

            const productId = data.product ? Number(data.product) : null;
            const product =
                productId != null
                    ? (products.find((candidate) => candidate.id === productId) ??
                      asyncProductSearch.getProduct(productId) ??
                      null)
                    : null;

            const userPrice =
                data.price != null && data.price !== ""
                    ? Number(data.price)
                    : (product?.price ?? 0);
            const quantity = Number(data.quantity) || 0;

            if (productId == null) return undefined;

            const baseItems = items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
            }));

            if (linkedId && typeof linkedId === "number") {
                const nextItems = baseItems.map((item, i) =>
                    items[i]?.id === linkedId ? { productId, quantity, price: userPrice } : item,
                );
                await updateOrder.mutateAsync({ id: order.id, items: nextItems });
                return linkedId;
            }

            const updated = await updateOrder.mutateAsync({
                id: order.id,
                items: [...baseItems, { productId, quantity, price: userPrice }],
            });
            return updated.items[updated.items.length - 1]?.id;
        },
        [items, order, products, asyncProductSearch, updateOrder],
    );

    const handleCellEdit = useCallback(
        (rowIndex: number, columnId: string, value: unknown) => {
            const current = items[rowIndex];
            if (!current) return;

            let nextItem = {
                productId: current.productId,
                quantity: current.quantity,
                price: current.price,
            };

            if (columnId === "product") {
                const productId = Number(value);
                const product =
                    products.find((p) => p.id === productId) ??
                    asyncProductSearch.getProduct(productId);
                if (!product) return;
                nextItem = { ...nextItem, productId, price: product.price };
            } else if (columnId === "quantity") {
                nextItem = { ...nextItem, quantity: Number(value) || 0 };
            } else if (columnId === "price") {
                nextItem = { ...nextItem, price: Number(value) || 0 };
            } else if (columnId === "total") {
                const newTotal = Number(value) || 0;
                const newPrice =
                    nextItem.quantity > 0 ? Math.round(newTotal / nextItem.quantity) : newTotal;
                nextItem = { ...nextItem, price: newPrice };
            } else {
                return;
            }

            // Preserve identity of untouched items so memoized rows can bail
            // out — only the edited row gets a new reference.
            const nextItems = items.map((item, i) => (i === rowIndex ? nextItem : item));
            persistItems(nextItems);
        },
        [items, persistItems, products, asyncProductSearch],
    );

    const totalSum = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (isLoading) {
        return (
            <PageTransition className="flex min-h-0 flex-1 flex-col p-2 md:p-4">
                <DataTableSkeleton columns={6} rows={5} className="flex-1" />
            </PageTransition>
        );
    }

    if (!order) {
        return (
            <PageTransition className="p-2 md:p-4">
                <p className="text-muted-foreground">{t("orders_empty")}</p>
            </PageTransition>
        );
    }

    return (
        <PageTransition className="flex min-h-0 flex-1 flex-col p-2 md:p-4">
            <div className="mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <motion.button
                        type="button"
                        onClick={() => navigate({ to: "/orders" })}
                        className="border-border text-muted-foreground hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                        whileTap={{ scale: 0.9 }}
                        aria-label={t("common:back")}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </motion.button>
                    <div>
                        <h1 className="text-xl font-bold md:text-2xl">
                            {t("lists_title")} #{order.id}
                        </h1>
                        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                            {order.user && <span>{order.user.fullname}</span>}
                            <span>·</span>
                            <span>{format(new Date(order.createdAt), "dd.MM.yyyy HH:mm")}</span>
                        </div>
                        {canUpdate ? (
                            <Input
                                ref={commentInputRef}
                                placeholder={t("order_comment")}
                                defaultValue={order.comment ?? ""}
                                onBlur={() => {
                                    const value = commentInputRef.current?.value ?? "";
                                    const newComment = value.trim() || null;
                                    if (newComment !== (order.comment ?? null)) {
                                        updateOrder.mutate({ id: order.id, comment: newComment });
                                    }
                                }}
                                className="mt-1 h-8 text-sm italic"
                            />
                        ) : (
                            order.comment && (
                                <p className="text-muted-foreground mt-1 text-sm italic">
                                    {order.comment}
                                </p>
                            )
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                    {canUpdate ? (
                        <div className="border-border flex overflow-hidden rounded-lg border">
                            {(["CASH", "CREDIT_CARD", "DEBT"] as const).map((type) => (
                                <motion.button
                                    key={type}
                                    type="button"
                                    className={`px-3 py-1.5 text-xs font-medium ${order.paymentType === type ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                                    onClick={() => {
                                        if (order.paymentType !== type) {
                                            updateOrder.mutate({ id: order.id, paymentType: type });
                                        }
                                    }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    {t(`payment_${type.toLowerCase()}`)}
                                </motion.button>
                            ))}
                        </div>
                    ) : (
                        <Badge variant="secondary">
                            {t(`payment_${order.paymentType.toLowerCase()}`)}
                        </Badge>
                    )}
                    <motion.div whileTap={{ scale: 0.9 }}>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => window.print()}
                            title={t("print_receipt")}
                        >
                            <Printer className="h-4 w-4" />
                        </Button>
                    </motion.div>
                    {canDelete && (
                        <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => setDeleteConfirmOpen(true)}
                            disabled={deleteOrder.isPending}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            <motion.div
                className="mb-4 flex items-center justify-end gap-2 text-lg font-semibold"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <span className="text-muted-foreground">{t("total_sum")}:</span>
                <span>{formatCurrency(totalSum, t("common:sum"))}</span>
                <span className="text-muted-foreground text-sm">
                    ({items.length} {t("order_items_count").toLowerCase()})
                </span>
            </motion.div>

            <DataTable
                className="costprice-table flex-1"
                columns={columns}
                initialColumnVisibility={initialColumnVisibility}
                data={items}
                enableSorting={false}
                translations={translations}
                {...(canUpdate && {
                    enableEditing: true,
                    onCellEdit: handleCellEdit,
                    onRowDelete: (rowIndex: number) => {
                        const id = items[rowIndex]?.id;
                        handleDeleteItem(rowIndex);
                        return id;
                    },
                    enableMultipleNewRows: true,
                    multiRowCount: 10,
                    multiRowMaxCount: 50,
                    onMultiRowSave: handleNewRowSave,
                    onMultiRowChange: handleNewRowChange,
                    multiRowDefaultValues: newRowDefaultValues,
                })}
            />

            <ConfirmDrawer
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
                onConfirm={() => {
                    deleteOrder.mutate(numericId, {
                        onSuccess: () => void navigate({ to: "/orders" }),
                    });
                }}
                isLoading={deleteOrder.isPending}
            />
            <OrderReceiptContainer
                receipts={[
                    {
                        orderId: order.id,
                        clientName: order.user?.fullname,
                        date: order.createdAt,
                        paymentType: order.paymentType,
                        comment: order.comment,
                        items: items.map((item) => ({
                            name: item.product?.name ?? "—",
                            quantity: item.quantity,
                            price: item.price,
                        })),
                        totalSum,
                    },
                ]}
            />
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/orders/$orderId")({
    beforeLoad: async () => {
        const { permissions } = useAuthStore.getState();
        const canReadOrders = hasAnyPermission(permissions, [
            Permission.ORDERS_READ_ALL,
            Permission.ORDERS_READ_OWN,
        ]);
        if (!canReadOrders) {
            throw redirect({ to: "/" });
        }
    },
    component: OrderDetailPage,
});
