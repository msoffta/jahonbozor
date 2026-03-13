import type { Logger } from "@jahonbozor/logger";
import { prisma } from "@backend/lib/prisma";
import type {
	AnalyticsPeriodQuery,
	AnalyticsSummaryResponse,
	DailySalesData,
	TopProductData,
	CategorySalesData,
} from "@jahonbozor/schemas/src/analytics";

export abstract class AnalyticsService {
	static async getAnalyticsSummary(
		query: AnalyticsPeriodQuery,
		logger: Logger,
	): Promise<AnalyticsSummaryResponse> {
		try {
			// Determine date range - default to today
			const now = new Date();
			const startOfToday = new Date(now);
			startOfToday.setHours(0, 0, 0, 0);
			const endOfToday = new Date(now);
			endOfToday.setHours(23, 59, 59, 999);

			const dateFrom = query.dateFrom ? new Date(query.dateFrom) : startOfToday;
			const dateTo = query.dateTo ? new Date(query.dateTo) : endOfToday;

			// Fetch all orders for the period (regardless of status)
			const orders = await prisma.order.findMany({
				where: {
					createdAt: {
						gte: dateFrom,
						lte: dateTo,
					},
				},
				include: {
					items: {
						include: {
							product: {
								select: {
									id: true,
									name: true,
									categoryId: true,
								},
							},
						},
					},
				},
			});

			// Fetch all non-deleted expenses for the period
			const expenses = await prisma.expense.findMany({
				where: {
					expenseDate: {
						gte: dateFrom,
						lte: dateTo,
					},
					deletedAt: null,
				},
			});

			// Calculate overview metrics
			const totalSales = orders.reduce((sum, order) => {
				return (
					sum +
					order.items.reduce(
						(itemSum, item) => itemSum + Number(item.price) * item.quantity,
						0,
					)
				);
			}, 0);

			const totalExpenses = expenses.reduce(
				(sum, expense) => sum + Number(expense.amount),
				0,
			);

			const profit = totalSales - totalExpenses;

			// Daily breakdown
			const dailyMap = new Map<
				string,
				{
					totalSales: number;
					totalOrders: number;
					totalExpenses: number;
				}
			>();

			// Aggregate orders by day
			orders.forEach((order) => {
				const dateKey = order.createdAt.toISOString().split("T")[0];
				const orderTotal = order.items.reduce(
					(sum, item) => sum + Number(item.price) * item.quantity,
					0,
				);

				const existing = dailyMap.get(dateKey) || {
					totalSales: 0,
					totalOrders: 0,
					totalExpenses: 0,
				};

				dailyMap.set(dateKey, {
					totalSales: existing.totalSales + orderTotal,
					totalOrders: existing.totalOrders + 1,
					totalExpenses: existing.totalExpenses,
				});
			});

			// Aggregate expenses by day
			expenses.forEach((expense) => {
				const dateKey = expense.expenseDate.toISOString().split("T")[0];
				const existing = dailyMap.get(dateKey) || {
					totalSales: 0,
					totalOrders: 0,
					totalExpenses: 0,
				};

				dailyMap.set(dateKey, {
					...existing,
					totalExpenses: existing.totalExpenses + Number(expense.amount),
				});
			});

			const dailySales: DailySalesData[] = Array.from(dailyMap.entries())
				.map(([date, data]) => ({
					date,
					totalSales: data.totalSales,
					totalOrders: data.totalOrders,
					totalExpenses: data.totalExpenses,
					profit: data.totalSales - data.totalExpenses,
				}))
				.sort((a, b) => a.date.localeCompare(b.date));

			// Top products by quantity
			const productMap = new Map<
				number,
				{
					name: string;
					quantitySold: number;
					totalRevenue: number;
				}
			>();

			orders.forEach((order) => {
				order.items.forEach((item) => {
					const existing = productMap.get(item.productId) || {
						name: item.product.name,
						quantitySold: 0,
						totalRevenue: 0,
					};

					productMap.set(item.productId, {
						name: item.product.name,
						quantitySold: existing.quantitySold + item.quantity,
						totalRevenue:
							existing.totalRevenue + Number(item.price) * item.quantity,
					});
				});
			});

			const topProducts: TopProductData[] = Array.from(productMap.entries())
				.map(([productId, data]) => ({
					productId,
					productName: data.name,
					quantitySold: data.quantitySold,
					totalRevenue: data.totalRevenue,
				}))
				.sort((a, b) => b.quantitySold - a.quantitySold)
				.slice(0, 5);

			// Category breakdown
			const categoryMap = new Map<
				number,
				{
					name: string;
					totalRevenue: number;
					orderCount: Set<number>;
				}
			>();

			orders.forEach((order) => {
				order.items.forEach((item) => {
					if (!item.product.categoryId) return;

					const existing = categoryMap.get(item.product.categoryId) || {
						name: "",
						totalRevenue: 0,
						orderCount: new Set<number>(),
					};

					existing.totalRevenue += Number(item.price) * item.quantity;
					existing.orderCount.add(order.id);

					categoryMap.set(item.product.categoryId, existing);
				});
			});

			// Fetch category names
			const categoryIds = Array.from(categoryMap.keys());
			const categories = await prisma.category.findMany({
				where: { id: { in: categoryIds } },
				select: { id: true, name: true },
			});

			categories.forEach((cat) => {
				const existing = categoryMap.get(cat.id);
				if (existing) {
					existing.name = cat.name;
				}
			});

			const categoryBreakdown: CategorySalesData[] = Array.from(
				categoryMap.entries(),
			)
				.map(([categoryId, data]) => ({
					categoryId,
					categoryName: data.name,
					totalRevenue: data.totalRevenue,
					orderCount: data.orderCount.size,
				}))
				.sort((a, b) => b.totalRevenue - a.totalRevenue);

			return {
				success: true,
				data: {
					period: {
						from: dateFrom.toISOString(),
						to: dateTo.toISOString(),
					},
					overview: {
						totalSales,
						totalExpenses,
						profit,
						ordersCount: orders.length,
						acceptedOrdersCount: orders.filter((o) => o.status === "ACCEPTED")
							.length,
					},
					dailySales,
					topProducts,
					categoryBreakdown,
				},
			};
		} catch (error) {
			logger.error("Analytics: Error in getAnalyticsSummary", { error });
			return { success: false, error };
		}
	}
}
