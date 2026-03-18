import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";

import {
    AnimatedList,
    AnimatedListItem,
    AnimatePresence,
    motion,
    PageTransition,
    Skeleton,
} from "@jahonbozor/ui";

import { ordersListOptions } from "@/api/orders.api";
import { OrderCard } from "@/components/orders/order-card";

function OrdersPage() {
    const { t } = useTranslation("orders");

    const { data, isLoading } = useQuery(ordersListOptions({}));
    const orders = data?.orders ?? [];

    return (
        <PageTransition>
            <AnimatePresence mode="wait">
                {isLoading && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-3 p-4"
                    >
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-20 w-full rounded-lg" />
                        ))}
                    </motion.div>
                )}

                {!isLoading && orders.length === 0 && (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex flex-col items-center justify-center px-4 py-16"
                    >
                        <ClipboardList className="text-muted-foreground h-16 w-16" />
                        <p className="text-muted-foreground mt-4">{t("no_data")}</p>
                    </motion.div>
                )}

                {!isLoading && orders.length > 0 && (
                    <AnimatedList key="orders">
                        {orders.map((order) => (
                            <AnimatedListItem key={order.id}>
                                <OrderCard
                                    id={order.id}
                                    paymentType={order.paymentType}
                                    createdAt={order.createdAt}
                                    items={order.items}
                                />
                            </AnimatedListItem>
                        ))}
                    </AnimatedList>
                )}
            </AnimatePresence>
        </PageTransition>
    );
}

export const Route = createFileRoute("/_user/orders/")({
    component: OrdersPage,
    loader: ({ context }) => {
        void context.queryClient.ensureQueryData(ordersListOptions({}));
    },
});
