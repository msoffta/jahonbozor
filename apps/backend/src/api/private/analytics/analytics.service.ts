import { prisma } from "@backend/lib/prisma";

import type { Logger } from "@jahonbozor/logger";
import type {
    AnalyticsPeriodQuery,
    AnalyticsSummaryResponse,
    DailySalesData,
} from "@jahonbozor/schemas/src/analytics";

interface OverviewRow {
    totalSales: number;
    ordersCount: number;
}

interface ExpenseTotalRow {
    totalExpenses: number;
}

interface DailyOrderRow {
    date: Date;
    totalSales: number;
    totalOrders: number;
}

interface DailyExpenseRow {
    date: Date;
    totalExpenses: number;
}

interface TopProductRow {
    productId: number;
    productName: string;
    quantitySold: number;
    totalRevenue: number;
}

interface CategoryRow {
    categoryId: number;
    categoryName: string;
    totalRevenue: number;
    orderCount: number;
}

export abstract class AnalyticsService {
    static async getAnalyticsSummary(
        query: AnalyticsPeriodQuery,
        logger: Logger,
    ): Promise<AnalyticsSummaryResponse> {
        try {
            const now = new Date();
            const startOfToday = new Date(now);
            startOfToday.setHours(0, 0, 0, 0);
            const endOfToday = new Date(now);
            endOfToday.setHours(23, 59, 59, 999);

            const dateFrom = query.dateFrom ? new Date(query.dateFrom) : startOfToday;
            const dateTo = query.dateTo ? new Date(query.dateTo) : endOfToday;

            const [
                overview,
                expenseTotal,
                dailyOrders,
                dailyExpenses,
                topProducts,
                categoryBreakdown,
            ] = await Promise.all([
                prisma.$queryRaw<OverviewRow[]>`
						SELECT
							COALESCE(SUM(oi.price * oi.quantity), 0)::float8 AS "totalSales",
							COUNT(DISTINCT o.id)::integer AS "ordersCount"
						FROM "Order" o
						LEFT JOIN "OrderItem" oi ON oi."orderId" = o.id
						WHERE o."createdAt" >= ${dateFrom}
							AND o."createdAt" <= ${dateTo}
							AND o."deletedAt" IS NULL
					`,

                prisma.$queryRaw<ExpenseTotalRow[]>`
						SELECT COALESCE(SUM(amount), 0)::float8 AS "totalExpenses"
						FROM "Expense"
						WHERE "expenseDate" >= ${dateFrom}
							AND "expenseDate" <= ${dateTo}
							AND "deletedAt" IS NULL
					`,

                prisma.$queryRaw<DailyOrderRow[]>`
						SELECT
							o."createdAt"::date AS date,
							COALESCE(SUM(oi.price * oi.quantity), 0)::float8 AS "totalSales",
							COUNT(DISTINCT o.id)::integer AS "totalOrders"
						FROM "Order" o
						LEFT JOIN "OrderItem" oi ON oi."orderId" = o.id
						WHERE o."createdAt" >= ${dateFrom}
							AND o."createdAt" <= ${dateTo}
							AND o."deletedAt" IS NULL
						GROUP BY o."createdAt"::date
						ORDER BY date
					`,

                prisma.$queryRaw<DailyExpenseRow[]>`
						SELECT
							"expenseDate"::date AS date,
							COALESCE(SUM(amount), 0)::float8 AS "totalExpenses"
						FROM "Expense"
						WHERE "expenseDate" >= ${dateFrom}
							AND "expenseDate" <= ${dateTo}
							AND "deletedAt" IS NULL
						GROUP BY "expenseDate"::date
					`,

                prisma.$queryRaw<TopProductRow[]>`
						SELECT
							oi."productId" AS "productId",
							p.name AS "productName",
							SUM(oi.quantity)::integer AS "quantitySold",
							SUM(oi.price * oi.quantity)::float8 AS "totalRevenue"
						FROM "OrderItem" oi
						JOIN "Order" o ON oi."orderId" = o.id
						JOIN "Product" p ON oi."productId" = p.id
						WHERE o."createdAt" >= ${dateFrom}
							AND o."createdAt" <= ${dateTo}
							AND o."deletedAt" IS NULL
						GROUP BY oi."productId", p.name
						ORDER BY "quantitySold" DESC
						LIMIT 5
					`,

                prisma.$queryRaw<CategoryRow[]>`
						SELECT
							p."categoryId" AS "categoryId",
							c.name AS "categoryName",
							SUM(oi.price * oi.quantity)::float8 AS "totalRevenue",
							COUNT(DISTINCT o.id)::integer AS "orderCount"
						FROM "OrderItem" oi
						JOIN "Order" o ON oi."orderId" = o.id
						JOIN "Product" p ON oi."productId" = p.id
						JOIN "Category" c ON p."categoryId" = c.id
						WHERE o."createdAt" >= ${dateFrom}
							AND o."createdAt" <= ${dateTo}
							AND o."deletedAt" IS NULL
							AND p."categoryId" IS NOT NULL
						GROUP BY p."categoryId", c.name
						ORDER BY "totalRevenue" DESC
					`,
            ]);

            const { totalSales, ordersCount } = overview[0];
            const { totalExpenses } = expenseTotal[0];
            const profit = totalSales - totalExpenses;

            // Merge daily orders and daily expenses into unified DailySalesData[]
            const dailyMap = new Map<string, DailySalesData>();

            for (const row of dailyOrders) {
                const dateKey = row.date.toISOString().split("T")[0];
                dailyMap.set(dateKey, {
                    date: dateKey,
                    totalSales: row.totalSales,
                    totalOrders: row.totalOrders,
                    totalExpenses: 0,
                    profit: row.totalSales,
                });
            }

            for (const row of dailyExpenses) {
                const dateKey = row.date.toISOString().split("T")[0];
                const existing = dailyMap.get(dateKey);
                if (existing) {
                    existing.totalExpenses = row.totalExpenses;
                    existing.profit = existing.totalSales - row.totalExpenses;
                } else {
                    dailyMap.set(dateKey, {
                        date: dateKey,
                        totalSales: 0,
                        totalOrders: 0,
                        totalExpenses: row.totalExpenses,
                        profit: -row.totalExpenses,
                    });
                }
            }

            const dailySales = Array.from(dailyMap.values()).sort((a, b) =>
                a.date.localeCompare(b.date),
            );

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
                        ordersCount,
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
