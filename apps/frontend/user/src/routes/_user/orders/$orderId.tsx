import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { orderDetailOptions, useCancelOrder } from "@/api/orders.api";
import { ProductCard } from "@/components/catalog/product-card";
import { Separator, Skeleton, PageTransition, AnimatedList, AnimatedListItem, AnimatePresence, motion } from "@jahonbozor/ui";
import { useUIStore } from "@/stores/ui.store";
import { PageHeader } from "@/components/layout/page-header";
import { OrderStatusBadge, getPaymentTypeLabel } from "@/components/orders/order-status-badge";
import { formatPrice, formatDate, getLocaleCode } from "@/lib/format";

function OrderDetailPage() {
    const { orderId } = Route.useParams();
    const { t } = useTranslation();

    const locale = useUIStore((state) => state.locale);
    const loc = getLocaleCode(locale);
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
            <PageHeader crumbs={[{ label: t("orders"), to: "/orders" }, { label: t("order_number", { id: order.id }) }]} />
            <div className="px-4">

            <h1 className="text-xl font-bold">{t("order_number", { id: order.id })}</h1>

            <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("creation_date")}:</span>
                    <span>{formatDate(order.createdAt, loc)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("update_date")}:</span>
                    <span>{formatDate(order.updatedAt, loc)}</span>
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
                    <span className="font-bold">{formatPrice(total, loc)} {t("sum")}</span>
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
                            className="mt-4 w-full rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50"
                            disabled={cancelOrder.isPending}
                            onClick={() => cancelOrder.mutate(order.id)}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                            {cancelOrder.isPending ? t("loading") : t("cancel_order")}
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>

            <Separator className="my-4" />

            <h2 className="mb-3 text-sm font-semibold">{t("order_items")}:</h2>
            <AnimatedList className="space-y-3">
                {order.items.map((item) => (
                    <AnimatedListItem key={item.id}>
                        <ProductCard
                            variant="order"
                            name={item.product?.name ?? t("product_fallback", { id: item.productId })}
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
    component: OrderDetailPage,
});
