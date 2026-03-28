import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowLeft, Printer, Save, Trash2 } from "lucide-react";

import { hasAnyPermission, Permission } from "@jahonbozor/schemas";
import {
    AnimatePresence,
    Badge,
    Button,
    DataTable,
    DataTableSkeleton,
    Input,
    motion,
    PageTransition,
    toast,
    useIsMobile,
} from "@jahonbozor/ui";

import { orderDetailQueryOptions, useDeleteOrder, useUpdateOrder } from "@/api/orders.api";
import { productsListQueryOptions, searchProductsFn } from "@/api/products.api";
import { getOrderItemColumns } from "@/components/orders/order-items-columns";
import { OrderReceiptContainer } from "@/components/orders/order-receipt";
import { ConfirmDrawer } from "@/components/shared/confirm-drawer";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { useHasPermission } from "@/hooks/use-permissions";
import { formatCurrency } from "@/lib/format";
import { useAuthStore } from "@/stores/auth.store";

import type { DataTableRef } from "@jahonbozor/ui";

interface LocalItem {
    id: number;
    productId: number;
    quantity: number;
    price: number;
    product: { id: number; name: string; price?: number; remaining?: number; costprice?: number };
}

function OrderDetailPage() {
    const { orderId } = Route.useParams();
    const { t } = useTranslation("orders");
    const navigate = useNavigate();
    const translations = useDataTableTranslations(t("no_items"));
    const tableRef = useRef<DataTableRef>(null);
    const numericId = Number(orderId);

    // Permission checks
    const canDelete = useHasPermission(Permission.ORDERS_DELETE);
    const canUpdate = useHasPermission(Permission.ORDERS_UPDATE_OWN);

    const { data: order, isLoading } = useQuery(orderDetailQueryOptions(numericId));

    const { data: productsData } = useQuery(
        productsListQueryOptions({ limit: 50, includeDeleted: false }),
    );

    const deleteOrder = useDeleteOrder();
    const updateOrder = useUpdateOrder();
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const serverComment = order?.comment ?? "";
    const [editComment, setEditComment] = useState(serverComment);
    const [prevServerComment, setPrevServerComment] = useState(serverComment);

    if (serverComment !== prevServerComment) {
        setPrevServerComment(serverComment);
        setEditComment(serverComment);
    }

    const products = productsData?.products ?? [];

    // Server items → local editable state (same sync pattern as editComment)
    const serverItems: LocalItem[] = useMemo(() => {
        if (!order?.items) return [];
        return order.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            product: item.product,
        }));
    }, [order]);

    const [editItems, setEditItems] = useState<LocalItem[]>(serverItems);
    const [prevServerItems, setPrevServerItems] = useState(serverItems);

    if (serverItems !== prevServerItems) {
        setPrevServerItems(serverItems);
        setEditItems(serverItems);
    }

    const itemsChanged = useMemo(() => {
        if (editItems.length !== serverItems.length) return true;
        return editItems.some((item, i) => {
            const server = serverItems[i];
            return (
                item.productId !== server.productId ||
                item.quantity !== server.quantity ||
                item.price !== server.price
            );
        });
    }, [editItems, serverItems]);

    const handleDeleteItem = useCallback((index: number) => {
        setEditItems((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const columns = useMemo(
        () =>
            canUpdate
                ? getOrderItemColumns(t, products, {
                      onDelete: handleDeleteItem,
                      onSearchProducts: searchProductsFn,
                  })
                : getOrderItemColumns(t, products),
        [t, products, canUpdate, handleDeleteItem],
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

    const handleNewRowSave = useCallback(
        (data: Record<string, unknown>, _rowId: string, linkedId?: unknown) => {
            if (!data.product) return;

            const productId = Number(data.product);
            const product = products.find((p) => p.id === productId);
            if (!product) return;

            const userPrice =
                data.price != null && data.price !== "" ? Number(data.price) : product.price;

            if (linkedId) {
                setEditItems((prev) =>
                    prev.map((item) =>
                        item.id === linkedId
                            ? {
                                  ...item,
                                  productId,
                                  quantity: Number(data.quantity) || 0,
                                  price: userPrice,
                                  product: {
                                      id: product.id,
                                      name: product.name,
                                      price: product.price,
                                      remaining: product.remaining,
                                      costprice: product.costprice,
                                  },
                              }
                            : item,
                    ),
                );
                return linkedId;
            }

            const newId = Date.now() + Math.round(performance.now() * 1000);
            const newItem: LocalItem = {
                id: newId,
                productId,
                quantity: Number(data.quantity) || 0,
                price: userPrice,
                product: {
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    remaining: product.remaining,
                    costprice: product.costprice,
                },
            };

            setEditItems((prev) => [...prev, newItem]);
            return newId;
        },
        [products],
    );

    const handleCellEdit = useCallback(
        (rowIndex: number, columnId: string, value: unknown) => {
            if (columnId === "product") {
                const productId = Number(value);
                const product = products.find((p) => p.id === productId);
                if (!product) return;
                setEditItems((prev) =>
                    prev.map((item, i) =>
                        i === rowIndex
                            ? {
                                  ...item,
                                  productId,
                                  price: product.price,
                                  product: {
                                      id: product.id,
                                      name: product.name,
                                      price: product.price,
                                      remaining: product.remaining,
                                      costprice: product.costprice,
                                  },
                              }
                            : item,
                    ),
                );
            } else if (columnId === "quantity") {
                setEditItems((prev) =>
                    prev.map((item, i) =>
                        i === rowIndex ? { ...item, quantity: Number(value) || 0 } : item,
                    ),
                );
            } else if (columnId === "price") {
                setEditItems((prev) =>
                    prev.map((item, i) =>
                        i === rowIndex ? { ...item, price: Number(value) || 0 } : item,
                    ),
                );
            } else if (columnId === "total") {
                const newTotal = Number(value) || 0;
                setEditItems((prev) =>
                    prev.map((item, i) => {
                        if (i !== rowIndex) return item;
                        const newPrice =
                            item.quantity > 0 ? Math.round(newTotal / item.quantity) : newTotal;
                        return { ...item, price: newPrice };
                    }),
                );
            }
        },
        [products],
    );

    async function handleSaveItems() {
        await tableRef.current?.flushPendingRows();

        if (editItems.length < 1) {
            toast.error(t("min_items_required"));
            return;
        }

        updateOrder.mutate(
            {
                id: order!.id,
                items: editItems.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price,
                })),
            },
            {
                onSuccess: () => {
                    toast.success(t("items_saved"));
                },
            },
        );
    }

    const totalSum = editItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    function handleDelete() {
        setDeleteConfirmOpen(true);
    }

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
            {/* Header */}
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
                                placeholder={t("order_comment")}
                                value={editComment}
                                onChange={(e) => setEditComment(e.target.value)}
                                onBlur={() => {
                                    const newComment = editComment.trim() || null;
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
                    <Badge variant="secondary">
                        {t(`payment_${order.paymentType.toLowerCase()}`)}
                    </Badge>
                    <AnimatePresence>
                        {canUpdate && itemsChanged && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                            >
                                <Button
                                    onClick={handleSaveItems}
                                    disabled={editItems.length < 1 || updateOrder.isPending}
                                    className="gap-2"
                                >
                                    <Save className="h-4 w-4" />
                                    {t("save_list")}
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
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
                            onClick={handleDelete}
                            disabled={deleteOrder.isPending}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Total */}
            <motion.div
                className="mb-4 flex items-center justify-end gap-2 text-lg font-semibold"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <span className="text-muted-foreground">{t("total_sum")}:</span>
                <span>{formatCurrency(totalSum, t("common:sum"))}</span>
                <span className="text-muted-foreground text-sm">
                    ({editItems.length} {t("order_items_count").toLowerCase()})
                </span>
            </motion.div>

            {/* Items table */}
            <DataTable
                ref={tableRef}
                className="costprice-table flex-1"
                columns={columns}
                initialColumnVisibility={initialColumnVisibility}
                data={editItems}
                enableSorting={false}
                translations={translations}
                {...(canUpdate && {
                    enableEditing: true,
                    onCellEdit: handleCellEdit,
                    enableMultipleNewRows: true,
                    multiRowCount: 50,
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
                        items: serverItems.map((item) => ({
                            name: item.product?.name ?? "—",
                            quantity: item.quantity,
                            price: item.price,
                        })),
                        totalSum: serverItems.reduce(
                            (sum, item) => sum + item.price * item.quantity,
                            0,
                        ),
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
