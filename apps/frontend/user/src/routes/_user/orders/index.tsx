import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { ordersListOptions } from "@/api/orders.api";
import { OrderCard } from "@/components/orders/order-card";
import { Skeleton, cn, PageTransition, motion, AnimatePresence, AnimatedList, AnimatedListItem } from "@jahonbozor/ui";

interface OrdersSearch {
    tab?: "active" | "history";
}

function OrdersPage() {
    const { t } = useTranslation();
    const { tab: initialTab } = Route.useSearch();
    const [activeTab, setActiveTab] = useState<"active" | "history">(initialTab ?? "active");

    const status = activeTab === "active" ? "NEW" as const : undefined;
    const { data, isLoading } = useQuery(ordersListOptions({ status }));

    const orders = activeTab === "active"
        ? (data?.orders ?? [])
        : (data?.orders ?? []).filter((order) => order.status !== "NEW");

    return (
        <PageTransition>
            <div className="flex border-b">
                <motion.button
                    type="button"
                    onClick={() => setActiveTab("active")}
                    className={cn(
                        "flex-1 py-3 text-center text-sm font-medium transition-colors",
                        activeTab === "active"
                            ? "border-b-2 border-primary text-primary"
                            : "text-muted-foreground",
                    )}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    {t("active_orders")}
                </motion.button>
                <motion.button
                    type="button"
                    onClick={() => setActiveTab("history")}
                    className={cn(
                        "flex-1 py-3 text-center text-sm font-medium transition-colors",
                        activeTab === "history"
                            ? "border-b-2 border-primary text-primary"
                            : "text-muted-foreground",
                    )}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    {t("order_history")}
                </motion.button>
            </div>

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
                        <ClipboardList className="h-16 w-16 text-muted-foreground" />
                        <p className="mt-4 text-muted-foreground">{t("no_data")}</p>
                    </motion.div>
                )}

                {!isLoading && orders.length > 0 && (
                    <AnimatedList key="orders">
                        {orders.map((order) => (
                            <AnimatedListItem key={order.id}>
                                <OrderCard
                                    id={order.id}
                                    status={order.status}
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
    validateSearch: (search: Record<string, unknown>): OrdersSearch => ({
        tab: search.tab === "history" ? "history" : "active",
    }),
});
