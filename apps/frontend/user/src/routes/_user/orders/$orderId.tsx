import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
    AnimatedList,
    AnimatedListItem,
    AnimatePresence,
    motion,
    PageTransition,
    Separator,
    Skeleton,
} from "@jahonbozor/ui";

import { orderDetailOptions, useCancelOrder } from "@/api/orders.api";
import { ProductCard } from "@/components/catalog/product-card";
import { PageHeader } from "@/components/layout/page-header";
import { getPaymentTypeLabel, OrderStatusBadge } from "@/components/orders/order-status-badge";
import { ConfirmDrawer } from "@/components/shared/confirm-drawer";
import { formatDate, formatPrice, getLocaleCode } from "@/lib/format";
import { useUIStore } from "@/stores/ui.store";

function OrderDetailPage() {
    const { orderId } = Route.useParams();
    const { t } = useTranslation("orders");
    const [confirmOpen, setConfirmOpen] = useState(false);

    const locale = useUIStore((state) => state.locale);
    const localeCode = getLocaleCode(locale);
    const { data: order, isLoading } = useQuery(orderDetailOptions(Number(orderId)));
    const cancelOrder = useCancelOrder();

    if (isLoading) {
        return (
            <PageTransition className="space-y-4 p-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
            </PageTransition>
        );
    }

    if (!order) {
        return (
            <PageTransition className="p-4 text-center">
                <p className="text-muted-foreground">{t("no_data")}</p>
            </PageTransition>
        );
    }

    const total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return (
        <PageTransition>
            <PageHeader
                crumbs={[
                    { label: t("orders"), to: "/orders" },
                    { label: t("order_number", { id: order.id }) },
                ]}
            />
            <div className="px-4">
                <h1 className="text-xl font-bold">{t("order_number", { id: order.id })}</h1>

                <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("creation_date")}:</span>
                        <span>{formatDate(order.createdAt, localeCode)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("update_date")}:</span>
                        <span>{formatDate(order.updatedAt, localeCode)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("status")}:</span>
                        <OrderStatusBadge status={order.status} />
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("payment_method")}:</span>
                        <span>{getPaymentTypeLabel(order.paymentType, t)}</span>
                    </div>
                    <AnimatePresence>
                        {order.comment && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="flex justify-between text-sm"
                            >
                                <span className="text-muted-foreground">{t("order_comment")}:</span>
                                <span className="text-right italic">{order.comment}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("total")}:</span>
                        <span className="font-bold">
                            {formatPrice(total, localeCode)} {t("sum")}
                        </span>
                    </div>
                </div>

                <AnimatePresence>
                    {order.status === "NEW" && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <motion.button
                                type="button"
                                className="bg-destructive text-destructive-foreground mt-4 w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                                disabled={cancelOrder.isPending}
                                onClick={() => setConfirmOpen(true)}
                                whileTap={{ scale: 0.95 }}
                                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            >
                                {cancelOrder.isPending ? t("loading") : t("cancel_order")}
                            </motion.button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <ConfirmDrawer
                    open={confirmOpen}
                    onOpenChange={setConfirmOpen}
                    onConfirm={() => cancelOrder.mutate(order.id)}
                    isLoading={cancelOrder.isPending}
                />

                <Separator className="my-4" />

                <h2 className="mb-3 text-sm font-semibold">{t("order_items")}:</h2>
                <AnimatedList className="space-y-3">
                    {order.items.map((item) => (
                        <AnimatedListItem key={item.id}>
                            <ProductCard
                                variant="order"
                                name={
                                    item.product?.name ??
                                    t("product_fallback", { id: item.productId })
                                }
                                price={item.price}
                                quantity={item.quantity}
                            />
                        </AnimatedListItem>
                    ))}
                </AnimatedList>
            </div>
        </PageTransition>
    );
}

export const Route = createFileRoute("/_user/orders/$orderId")({
    loader: ({ context, params }) => {
        void context.queryClient.ensureQueryData(orderDetailOptions(Number(params.orderId)));
    },
    component: OrderDetailPage,
});
