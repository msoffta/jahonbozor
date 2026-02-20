import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { ordersListOptions } from "@/api/orders.api";
import { OrderCard } from "@/components/orders/order-card";
import { Skeleton } from "@jahonbozor/ui";
import { cn } from "@jahonbozor/ui";

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
        : (data?.orders ?? []).filter(o => o.status !== "NEW");

    return (
        <div>
            <div className="flex border-b">
                <button
                    onClick={() => setActiveTab("active")}
                    className={cn(
                        "flex-1 py-3 text-center text-sm font-medium transition-colors",
                        activeTab === "active"
                            ? "border-b-2 border-primary text-primary"
                            : "text-muted-foreground",
                    )}
                >
                    {t("active_orders")}
                </button>
                <button
                    onClick={() => setActiveTab("history")}
                    className={cn(
                        "flex-1 py-3 text-center text-sm font-medium transition-colors",
                        activeTab === "history"
                            ? "border-b-2 border-primary text-primary"
                            : "text-muted-foreground",
                    )}
                >
                    {t("order_history")}
                </button>
            </div>

            {isLoading && (
                <div className="space-y-3 p-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-lg" />
                    ))}
                </div>
            )}

            {!isLoading && orders.length === 0 && (
                <div className="flex flex-col items-center justify-center px-4 py-16">
                    <ClipboardList className="h-16 w-16 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">{t("no_data")}</p>
                </div>
            )}

            {!isLoading && orders.length > 0 && (
                <div>
                    {orders.map((order) => (
                        <OrderCard
                            key={order.id}
                            id={order.id}
                            status={order.status}
                            paymentType={order.paymentType}
                            createdAt={order.createdAt}
                            items={order.items}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export const Route = createFileRoute("/_user/orders/")({
    component: OrdersPage,
    validateSearch: (search: Record<string, unknown>): OrdersSearch => ({
        tab: search.tab === "history" ? "history" : "active",
    }),
});
