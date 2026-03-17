import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";

import {
    AnimatedList,
    AnimatedListItem,
    AnimatePresence,
    cn,
    motion,
    PageTransition,
    Skeleton,
} from "@jahonbozor/ui";

import { ordersListOptions } from "@/api/orders.api";
import { OrderCard } from "@/components/orders/order-card";

interface OrdersSearch {
    tab?: "active" | "history";
}

function OrdersPage() {
    const { t } = useTranslation("orders");
    const { tab: initialTab } = Route.useSearch();
    const [activeTab, setActiveTab] = useState<"active" | "history">(initialTab ?? "active");

    const { data: activeData, isLoading: activeLoading } = useQuery(
        ordersListOptions({ status: "NEW" }),
    );
    const { data: historyData, isLoading: historyLoading } = useQuery(ordersListOptions({}));

    const orders =
        activeTab === "active"
            ? (activeData?.orders ?? [])
            : (historyData?.orders ?? []).filter((order) => order.status !== "NEW");
    const isLoading = activeTab === "active" ? activeLoading : historyLoading;

    return (
        <PageTransition>
            <div className="flex border-b" role="tablist">
                <motion.button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "active"}
                    onClick={() => setActiveTab("active")}
                    className={cn(
                        "flex-1 py-3 text-center text-sm font-medium transition-colors",
                        activeTab === "active"
                            ? "border-primary text-primary border-b-2"
                            : "text-muted-foreground",
                    )}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    {t("active_orders")}
                </motion.button>
                <motion.button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "history"}
                    onClick={() => setActiveTab("history")}
                    className={cn(
                        "flex-1 py-3 text-center text-sm font-medium transition-colors",
                        activeTab === "history"
                            ? "border-primary text-primary border-b-2"
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
    loader: ({ context }) => {
        void context.queryClient.ensureQueryData(ordersListOptions({ status: "NEW" }));
    },
});
