import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { endOfMonth, startOfMonth } from "date-fns";
import { DollarSign, ShoppingCart, TrendingDown, TrendingUp } from "lucide-react";

import { hasPermission, Permission } from "@jahonbozor/schemas";
import { Button, DatePicker, PageTransition } from "@jahonbozor/ui";

import { analyticsSummaryQueryOptions } from "@/api/analytics.api";
import { CategoryBreakdownChart } from "@/components/analytics/category-breakdown-chart";
import { SalesTrendChart } from "@/components/analytics/sales-trend-chart";
import { StatCard } from "@/components/analytics/stat-card";
import { TopProductsChart } from "@/components/analytics/top-products-chart";
import { useAuthStore } from "@/stores/auth.store";

function SummaryPage() {
    const { t, i18n } = useTranslation("analytics");

    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    const [dateFrom, setDateFrom] = useState<Date>(monthStart);
    const [dateTo, setDateTo] = useState<Date>(monthEnd);

    const { data, isLoading, error } = useQuery(
        analyticsSummaryQueryOptions({
            dateFrom: dateFrom.toISOString(),
            dateTo: dateTo.toISOString(),
        }),
    );

    if (isLoading) {
        return (
            <PageTransition className="p-3 md:p-6">
                <div className="text-center">{t("common:loading")}</div>
            </PageTransition>
        );
    }

    if (error) {
        return (
            <PageTransition className="p-3 md:p-6">
                <div className="text-destructive text-center">{t("common:error")}</div>
            </PageTransition>
        );
    }

    const overview = data?.overview;
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat(i18n.language === "ru" ? "ru-RU" : "uz-UZ", {
            style: "currency",
            currency: "UZS",
            maximumFractionDigits: 0,
        }).format(value);

    return (
        <>
            <PageTransition className="flex flex-col gap-4 p-3 pb-40 md:gap-6 md:p-6 md:pb-32">
                {/* Header with filters */}
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h1 className="text-xl font-bold md:text-2xl">{t("analytics_dashboard")}</h1>
                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        <div className="flex items-center gap-2">
                            <DatePicker
                                value={dateFrom.toISOString()}
                                onChange={(date) => {
                                    if (date) setDateFrom(new Date(date));
                                }}
                                className="h-8 w-28 text-xs sm:w-36"
                            />
                            <span className="text-muted-foreground text-xs">—</span>
                            <DatePicker
                                value={dateTo.toISOString()}
                                onChange={(date) => {
                                    if (date) setDateTo(new Date(date));
                                }}
                                className="h-8 w-28 text-xs sm:w-36"
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setDateFrom(monthStart);
                                setDateTo(monthEnd);
                            }}
                        >
                            {t("common:this_month")}
                        </Button>
                    </div>
                </div>

                {/* Overview Cards */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title={t("total_sales")}
                        value={formatCurrency(overview?.totalSales ?? 0)}
                        icon={DollarSign}
                        iconColor="text-muted-foreground"
                    />
                    <StatCard
                        title={t("total_expenses")}
                        value={formatCurrency(overview?.totalExpenses ?? 0)}
                        icon={TrendingDown}
                        iconColor="text-muted-foreground"
                    />
                    <StatCard
                        title={t("profit")}
                        value={formatCurrency(overview?.profit ?? 0)}
                        icon={TrendingUp}
                        iconColor="text-muted-foreground"
                    />
                    <StatCard
                        title={t("orders_count")}
                        value={overview?.ordersCount ?? 0}
                        icon={ShoppingCart}
                        iconColor="text-muted-foreground"
                    />
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="lg:col-span-2">
                        <SalesTrendChart data={data?.dailySales ?? []} />
                    </div>
                    <TopProductsChart data={data?.topProducts ?? []} />
                    <CategoryBreakdownChart data={data?.categoryBreakdown ?? []} />
                </div>
            </PageTransition>

            {/* Fixed Summary Footer (above bottom nav) */}
            <div className="border-border bg-background fixed right-0 bottom-22 left-0 z-10 border-t px-3 py-3 shadow-lg md:bottom-16 md:px-6 md:py-4">
                <div className="grid grid-cols-3 gap-2 md:gap-4">
                    <div className="text-center">
                        <p className="text-muted-foreground text-xs md:text-sm">
                            {t("total_sales")}
                        </p>
                        <p className="text-foreground text-lg font-bold md:text-2xl">
                            {formatCurrency(overview?.totalSales ?? 0)}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-muted-foreground text-xs md:text-sm">
                            {t("total_expenses")}
                        </p>
                        <p className="text-foreground text-lg font-bold md:text-2xl">
                            {formatCurrency(overview?.totalExpenses ?? 0)}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-muted-foreground text-xs md:text-sm">{t("profit")}</p>
                        <p className="text-foreground text-lg font-bold md:text-2xl">
                            {formatCurrency(overview?.profit ?? 0)}
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}

export const Route = createFileRoute("/_dashboard/summary")({
    beforeLoad: async () => {
        const { permissions } = useAuthStore.getState();
        if (!hasPermission(permissions, Permission.ANALYTICS_VIEW)) {
            throw redirect({ to: "/" });
        }
    },
    component: SummaryPage,
});
