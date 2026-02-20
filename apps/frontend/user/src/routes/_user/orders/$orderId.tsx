import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { orderDetailOptions, useCancelOrder } from "@/api/orders.api";
import { ProductCard } from "@/components/catalog/product-card";
import { Badge, Button, Separator, Skeleton } from "@jahonbozor/ui";
import { PageHeader } from "@/components/layout/page-header";

function formatPrice(price: number): string {
    return price.toLocaleString("ru-RU").replace(/,/g, " ");
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function OrderDetailPage() {
    const { orderId } = Route.useParams();
    const { t } = useTranslation();

    const { data: order, isLoading } = useQuery(orderDetailOptions(Number(orderId)));
    const cancelOrder = useCancelOrder();

    if (isLoading) {
        return (
            <div className="space-y-4 p-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="p-4 text-center">
                <p className="text-muted-foreground">{t("no_data")}</p>
            </div>
        );
    }

    const total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return (
        <div>
            <PageHeader crumbs={[{ label: t("orders"), to: "/orders" }, { label: t("order_number", { id: order.id }) }]} />
            <div className="px-4">

            <h1 className="text-xl font-bold">{t("order_number", { id: order.id })}</h1>

            <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("creation_date")}:</span>
                    <span>{formatDate(order.createdAt)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("update_date")}:</span>
                    <span>{formatDate(order.updatedAt)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("status")}:</span>
                    <Badge
                        variant={order.status === "NEW" ? "default" : order.status === "CANCELLED" ? "destructive" : "secondary"}
                        className={order.status === "NEW" ? "bg-primary" : order.status === "CANCELLED" ? "" : "bg-green-600 text-white"}
                    >
                        {order.status === "NEW" ? t("status_new") : order.status === "CANCELLED" ? t("status_cancelled") : t("status_accepted")}
                    </Badge>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("payment_method")}:</span>
                    <span>{order.paymentType === "CREDIT_CARD" ? t("payment_card") : t("payment_cash")}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("total")}:</span>
                    <span className="font-bold">{formatPrice(total)} {t("sum")}</span>
                </div>
            </div>

            {order.status === "NEW" && (
                <Button
                    variant="destructive"
                    className="mt-4 w-full"
                    disabled={cancelOrder.isPending}
                    onClick={() => cancelOrder.mutate(order.id)}
                >
                    {cancelOrder.isPending ? t("loading") : t("cancel_order")}
                </Button>
            )}

            <Separator className="my-4" />

            <h2 className="mb-3 text-sm font-semibold">{t("order_items")}:</h2>
            <div className="space-y-3">
                {order.items.map((item) => (
                    <ProductCard
                        key={item.id}
                        variant="order"
                        name={item.product?.name ?? `Product #${item.productId}`}
                        price={item.price}
                        quantity={item.quantity}
                    />
                ))}
            </div>
            </div>
        </div>
    );
}

export const Route = createFileRoute("/_user/orders/$orderId")({
    component: OrderDetailPage,
});
