import { createFileRoute, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageTransition } from "@jahonbozor/ui";
import { useQuery } from "@tanstack/react-query";
import { analyticsSummaryQueryOptions } from "@/api/analytics.api";
import { StatCard } from "@/components/analytics/stat-card";
import { SalesTrendChart } from "@/components/analytics/sales-trend-chart";
import { TopProductsChart } from "@/components/analytics/top-products-chart";
import { CategoryBreakdownChart } from "@/components/analytics/category-breakdown-chart";
import { DatePicker } from "@jahonbozor/ui";
import { DollarSign, TrendingUp, TrendingDown, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { Permission } from "@jahonbozor/schemas";
import { hasPermission } from "@jahonbozor/schemas/src/permissions/permissions.schema";

function SummaryPage() {
	const { t } = useTranslation();

	const [dateFrom, setDateFrom] = useState<Date | undefined>();
	const [dateTo, setDateTo] = useState<Date | undefined>();

	const { data, isLoading, error } = useQuery(
		analyticsSummaryQueryOptions({
			dateFrom: dateFrom?.toISOString(),
			dateTo: dateTo?.toISOString(),
		}),
	);

	if (isLoading) {
		return (
			<PageTransition className="p-6">
				<div className="text-center">{t("loading")}</div>
			</PageTransition>
		);
	}

	if (error) {
		return (
			<PageTransition className="p-6">
				<div className="text-center text-red-600">{t("error")}</div>
			</PageTransition>
		);
	}

	const overview = data?.overview;
	const formatCurrency = (value: number) =>
		new Intl.NumberFormat("uz-UZ", {
			style: "currency",
			currency: "UZS",
		}).format(value);

	return (
		<>
			<PageTransition className="flex flex-col gap-6 p-6 pb-32">
				{/* Header with filters */}
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold">{t("analytics_dashboard")}</h1>
					<div className="flex gap-2">
						<DatePicker
							value={dateFrom}
							onChange={setDateFrom}
							placeholder={t("date_from")}
						/>
						<DatePicker
							value={dateTo}
							onChange={setDateTo}
							placeholder={t("date_to")}
						/>
					</div>
				</div>

				{/* Overview Cards */}
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
					<StatCard
						title={t("total_sales")}
						value={formatCurrency(overview?.totalSales || 0)}
						icon={DollarSign}
						iconColor="text-zinc-700"
					/>
					<StatCard
						title={t("total_expenses")}
						value={formatCurrency(overview?.totalExpenses || 0)}
						icon={TrendingDown}
						iconColor="text-zinc-700"
					/>
					<StatCard
						title={t("profit")}
						value={formatCurrency(overview?.profit || 0)}
						icon={TrendingUp}
						iconColor="text-zinc-700"
					/>
					<StatCard
						title={t("orders_count")}
						value={overview?.ordersCount || 0}
						icon={ShoppingCart}
						iconColor="text-zinc-700"
					/>
				</div>

				{/* Charts */}
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<div className="lg:col-span-2">
						<SalesTrendChart data={data?.dailySales || []} />
					</div>
					<TopProductsChart data={data?.topProducts || []} />
					<CategoryBreakdownChart data={data?.categoryBreakdown || []} />
				</div>
			</PageTransition>

			{/* Fixed Summary Footer (above bottom nav) */}
			<div className="fixed bottom-16 left-0 right-0 z-10 border-t border-zinc-200 bg-white px-6 py-4 shadow-lg">
				<div className="grid grid-cols-3 gap-4">
					<div className="text-center">
						<p className="text-sm text-zinc-600">{t("total_sales")}</p>
						<p className="text-2xl font-bold text-zinc-900">
							{formatCurrency(overview?.totalSales || 0)}
						</p>
					</div>
					<div className="text-center">
						<p className="text-sm text-zinc-600">{t("total_expenses")}</p>
						<p className="text-2xl font-bold text-zinc-900">
							{formatCurrency(overview?.totalExpenses || 0)}
						</p>
					</div>
					<div className="text-center">
						<p className="text-sm text-zinc-600">{t("profit")}</p>
						<p className="text-2xl font-bold text-zinc-900">
							{formatCurrency(overview?.profit || 0)}
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
