import { orderDetailQueryOptions, useDeleteOrder } from "@/api/orders.api";
import { productsListQueryOptions } from "@/api/products.api";
import { getOrderItemColumns } from "@/components/orders/order-items-columns";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { Permission, hasAnyPermission } from "@jahonbozor/schemas";
import {
    Badge,
    Button,
    DataTable,
    DataTableSkeleton,
    motion,
    PageTransition,
} from "@jahonbozor/ui";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useHasPermission } from "@/hooks/use-permissions";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { ConfirmDrawer } from "@/components/shared/confirm-drawer";

function OrderDetailPage() {
    const { orderId } = Route.useParams();
    const { t } = useTranslation("orders");
    const navigate = useNavigate();
    const translations = useDataTableTranslations("no_items");
    const numericId = Number(orderId);

    // Permission check for delete action
    const canDelete = useHasPermission(Permission.ORDERS_DELETE);

    const { data: order, isLoading } = useQuery(
        orderDetailQueryOptions(numericId),
    );

    const { data: productsData } = useQuery(
        productsListQueryOptions({ limit: 100, includeDeleted: false }),
    );

    const deleteOrder = useDeleteOrder();
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const products = productsData?.products ?? [];

    const columns = useMemo(
        () => getOrderItemColumns(t, products),
        [t, products],
    );

    const orderItems = useMemo(() => {
        if (!order?.items) return [];
        return order.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            product: item.product,
        }));
    }, [order]);

    const totalSum = orderItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
    );

    function handleDelete() {
        setDeleteConfirmOpen(true);
    }

    if (isLoading) {
        return (
            <PageTransition className="p-6 flex-1 flex flex-col min-h-0">
                <DataTableSkeleton columns={6} rows={5} className="flex-1" />
            </PageTransition>
        );
    }

    if (!order) {
        return (
            <PageTransition className="p-6">
                <p className="text-muted-foreground">{t("orders_empty")}</p>
            </PageTransition>
        );
    }

    return (
        <PageTransition className="p-6 flex-1 flex flex-col min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <motion.button
                        type="button"
                        onClick={() => navigate({ to: "/orders" })}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                        whileTap={{ scale: 0.9 }}
                        aria-label={t("common:back")}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </motion.button>
                    <div>
                        <h1 className="text-2xl font-bold">
                            {t("lists_title")} #{order.id}
                        </h1>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {order.user && <span>{order.user.fullname}</span>}
                            <span>·</span>
                            <span>
                                {dayjs(order.createdAt).format(
                                    "DD.MM.YYYY HH:mm",
                                )}
                            </span>
                        </div>
                        {order.comment && (
                            <p className="mt-1 text-sm italic text-muted-foreground">
                                {order.comment}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Badge
                        variant={
                            order.status === "ACCEPTED" ? "default" : "outline"
                        }
                    >
                        {t(`status_${order.status.toLowerCase()}`)}
                    </Badge>
                    <Badge variant="secondary">
                        {t(`payment_${order.paymentType.toLowerCase()}`)}
                    </Badge>
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
                <span>{totalSum.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground">
                    ({order.items.length} {t("order_items_count").toLowerCase()}
                    )
                </span>
            </motion.div>

            {/* Items table (readonly) */}
            <DataTable
                className="flex-1 costprice-table"
                columns={columns}
                data={orderItems}
                enableSorting={false}
                translations={translations}
            />

            <ConfirmDrawer
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
                onConfirm={() => {
                    deleteOrder.mutate(numericId, {
                        onSuccess: () => navigate({ to: "/orders" }),
                    });
                }}
                isLoading={deleteOrder.isPending}
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
