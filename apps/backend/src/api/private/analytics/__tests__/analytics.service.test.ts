import { beforeEach, describe, expect, test } from "vitest";

import { createMockLogger, expectSuccess, prismaMock } from "@backend/test/setup";

import { AnalyticsService } from "../analytics.service";

import type { CategorySalesData, DailySalesData } from "@jahonbozor/schemas/src/analytics";

/**
 * Sets up the $queryRaw mock chain for all 6 parallel queries.
 * Order must match the Promise.all in analytics.service.ts:
 *   1. overview  2. expenseTotal  3. dailyOrders
 *   4. dailyExpenses  5. topProducts  6. categoryBreakdown
 */
function mockAnalyticsQueries({
    overview = { totalSales: 0, ordersCount: 0, acceptedOrdersCount: 0 },
    expenses = { totalExpenses: 0 },
    dailyOrders = [] as { date: Date; totalSales: number; totalOrders: number }[],
    dailyExpenses = [] as { date: Date; totalExpenses: number }[],
    topProducts = [] as {
        productId: number;
        productName: string;
        quantitySold: number;
        totalRevenue: number;
    }[],
    categoryBreakdown = [] as {
        categoryId: number;
        categoryName: string;
        totalRevenue: number;
        orderCount: number;
    }[],
} = {}) {
    prismaMock.$queryRaw
        .mockResolvedValueOnce([overview])
        .mockResolvedValueOnce([expenses])
        .mockResolvedValueOnce(dailyOrders)
        .mockResolvedValueOnce(dailyExpenses)
        .mockResolvedValueOnce(topProducts)
        .mockResolvedValueOnce(categoryBreakdown);
}

describe("AnalyticsService", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeEach(() => {
        mockLogger = createMockLogger();
    });

    describe("getAnalyticsSummary", () => {
        test("should return analytics with correct structure for default date range", async () => {
            mockAnalyticsQueries({
                overview: { totalSales: 2000, ordersCount: 1, acceptedOrdersCount: 0 },
                expenses: { totalExpenses: 500 },
            });

            const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

            const success = expectSuccess(result);
            expect(success.data!.overview.totalSales).toBe(2000);
            expect(success.data!.overview.totalExpenses).toBe(500);
            expect(success.data!.overview.profit).toBe(1500);
            expect(success.data!.overview.ordersCount).toBe(1);
            expect(success.data!.overview.acceptedOrdersCount).toBe(0);
            expect(success.data!.period.from).toBeDefined();
            expect(success.data!.period.to).toBeDefined();
            expect(success.data!.dailySales).toEqual([]);
            expect(success.data!.topProducts).toEqual([]);
            expect(success.data!.categoryBreakdown).toEqual([]);
        });

        test("should use custom date range when provided", async () => {
            const dateFrom = "2024-06-01T00:00:00.000Z";
            const dateTo = "2024-06-30T23:59:59.999Z";

            mockAnalyticsQueries();

            const result = await AnalyticsService.getAnalyticsSummary(
                { dateFrom, dateTo },
                mockLogger,
            );

            const success = expectSuccess(result);
            expect(success.data!.period.from).toBe(dateFrom);
            expect(success.data!.period.to).toBe(dateTo);
        });

        test("should calculate profit correctly (sales - expenses)", async () => {
            mockAnalyticsQueries({
                overview: { totalSales: 1000, ordersCount: 5, acceptedOrdersCount: 3 },
                expenses: { totalExpenses: 300 },
            });

            const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

            const success = expectSuccess(result);
            expect(success.data!.overview.totalSales).toBe(1000);
            expect(success.data!.overview.totalExpenses).toBe(300);
            expect(success.data!.overview.profit).toBe(700);
        });

        test("should handle negative profit when expenses exceed sales", async () => {
            mockAnalyticsQueries({
                overview: { totalSales: 100, ordersCount: 1, acceptedOrdersCount: 0 },
                expenses: { totalExpenses: 9999 },
            });

            const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

            const success = expectSuccess(result);
            expect(success.data!.overview.profit).toBe(-9899);
        });

        test("should handle empty data gracefully", async () => {
            mockAnalyticsQueries();

            const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

            const success = expectSuccess(result);
            expect(success.data!.overview.totalSales).toBe(0);
            expect(success.data!.overview.totalExpenses).toBe(0);
            expect(success.data!.overview.profit).toBe(0);
            expect(success.data!.overview.ordersCount).toBe(0);
            expect(success.data!.overview.acceptedOrdersCount).toBe(0);
            expect(success.data!.dailySales).toEqual([]);
            expect(success.data!.topProducts).toEqual([]);
            expect(success.data!.categoryBreakdown).toEqual([]);
        });

        test("should count accepted orders separately", async () => {
            mockAnalyticsQueries({
                overview: { totalSales: 400, ordersCount: 4, acceptedOrdersCount: 2 },
            });

            const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

            const success = expectSuccess(result);
            expect(success.data!.overview.ordersCount).toBe(4);
            expect(success.data!.overview.acceptedOrdersCount).toBe(2);
        });

        test("should merge daily orders and expenses into unified daily breakdown", async () => {
            mockAnalyticsQueries({
                overview: { totalSales: 500, ordersCount: 2, acceptedOrdersCount: 0 },
                expenses: { totalExpenses: 150 },
                dailyOrders: [
                    { date: new Date("2024-06-01"), totalSales: 200, totalOrders: 1 },
                    { date: new Date("2024-06-02"), totalSales: 300, totalOrders: 1 },
                ],
                dailyExpenses: [
                    { date: new Date("2024-06-01"), totalExpenses: 50 },
                    { date: new Date("2024-06-02"), totalExpenses: 100 },
                ],
            });

            const result = await AnalyticsService.getAnalyticsSummary(
                { dateFrom: "2024-06-01T00:00:00.000Z", dateTo: "2024-06-02T23:59:59.999Z" },
                mockLogger,
            );

            const success = expectSuccess(result);
            expect(success.data!.dailySales).toHaveLength(2);

            const day1 = success.data!.dailySales.find(
                (d: DailySalesData) => d.date === "2024-06-01",
            );
            const day2 = success.data!.dailySales.find(
                (d: DailySalesData) => d.date === "2024-06-02",
            );

            expect(day1?.totalSales).toBe(200);
            expect(day1?.totalExpenses).toBe(50);
            expect(day1?.profit).toBe(150);
            expect(day1?.totalOrders).toBe(1);

            expect(day2?.totalSales).toBe(300);
            expect(day2?.totalExpenses).toBe(100);
            expect(day2?.profit).toBe(200);
            expect(day2?.totalOrders).toBe(1);
        });

        test("should handle expense-only days in daily breakdown", async () => {
            mockAnalyticsQueries({
                expenses: { totalExpenses: 500 },
                dailyOrders: [{ date: new Date("2024-06-01"), totalSales: 200, totalOrders: 1 }],
                dailyExpenses: [
                    { date: new Date("2024-06-01"), totalExpenses: 100 },
                    { date: new Date("2024-06-02"), totalExpenses: 400 },
                ],
            });

            const result = await AnalyticsService.getAnalyticsSummary(
                { dateFrom: "2024-06-01T00:00:00.000Z", dateTo: "2024-06-02T23:59:59.999Z" },
                mockLogger,
            );

            const success = expectSuccess(result);
            expect(success.data!.dailySales).toHaveLength(2);

            const day1 = success.data!.dailySales.find(
                (d: DailySalesData) => d.date === "2024-06-01",
            );
            const day2 = success.data!.dailySales.find(
                (d: DailySalesData) => d.date === "2024-06-02",
            );

            expect(day1?.totalSales).toBe(200);
            expect(day1?.totalExpenses).toBe(100);
            expect(day1?.profit).toBe(100);

            // Expense-only day — no orders
            expect(day2?.totalSales).toBe(0);
            expect(day2?.totalOrders).toBe(0);
            expect(day2?.totalExpenses).toBe(400);
            expect(day2?.profit).toBe(-400);
        });

        test("should sort daily sales by date ascending", async () => {
            mockAnalyticsQueries({
                overview: { totalSales: 600, ordersCount: 3, acceptedOrdersCount: 0 },
                dailyOrders: [
                    { date: new Date("2024-06-03"), totalSales: 300, totalOrders: 1 },
                    { date: new Date("2024-06-01"), totalSales: 100, totalOrders: 1 },
                    { date: new Date("2024-06-02"), totalSales: 200, totalOrders: 1 },
                ],
            });

            const result = await AnalyticsService.getAnalyticsSummary(
                { dateFrom: "2024-06-01T00:00:00.000Z", dateTo: "2024-06-03T23:59:59.999Z" },
                mockLogger,
            );

            const success = expectSuccess(result);
            expect(success.data!.dailySales.map((d: DailySalesData) => d.date)).toEqual([
                "2024-06-01",
                "2024-06-02",
                "2024-06-03",
            ]);
        });

        test("should return top products from query results", async () => {
            mockAnalyticsQueries({
                overview: { totalSales: 5000, ordersCount: 10, acceptedOrdersCount: 5 },
                topProducts: [
                    { productId: 1, productName: "Laptop", quantitySold: 10, totalRevenue: 3000 },
                    { productId: 2, productName: "Phone", quantitySold: 8, totalRevenue: 1200 },
                    { productId: 3, productName: "Tablet", quantitySold: 5, totalRevenue: 800 },
                ],
            });

            const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

            const success = expectSuccess(result);
            expect(success.data!.topProducts).toHaveLength(3);
            expect(success.data!.topProducts[0].productName).toBe("Laptop");
            expect(success.data!.topProducts[0].quantitySold).toBe(10);
            expect(success.data!.topProducts[0].totalRevenue).toBe(3000);
            expect(success.data!.topProducts[2].productName).toBe("Tablet");
        });

        test("should return category breakdown from query results", async () => {
            mockAnalyticsQueries({
                overview: { totalSales: 2650, ordersCount: 2, acceptedOrdersCount: 0 },
                categoryBreakdown: [
                    {
                        categoryId: 1,
                        categoryName: "Electronics",
                        totalRevenue: 2500,
                        orderCount: 1,
                    },
                    { categoryId: 2, categoryName: "Clothing", totalRevenue: 150, orderCount: 1 },
                ],
            });

            const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

            const success = expectSuccess(result);
            expect(success.data!.categoryBreakdown).toHaveLength(2);

            const electronics = success.data!.categoryBreakdown.find(
                (c: CategorySalesData) => c.categoryName === "Electronics",
            );
            const clothing = success.data!.categoryBreakdown.find(
                (c: CategorySalesData) => c.categoryName === "Clothing",
            );

            expect(electronics?.totalRevenue).toBe(2500);
            expect(electronics?.orderCount).toBe(1);
            expect(clothing?.totalRevenue).toBe(150);
            expect(clothing?.orderCount).toBe(1);
        });

        test("should aggregate multiple orders and expenses on the same day", async () => {
            mockAnalyticsQueries({
                overview: { totalSales: 600, ordersCount: 3, acceptedOrdersCount: 0 },
                expenses: { totalExpenses: 125 },
                dailyOrders: [{ date: new Date("2024-06-01"), totalSales: 600, totalOrders: 3 }],
                dailyExpenses: [{ date: new Date("2024-06-01"), totalExpenses: 125 }],
            });

            const result = await AnalyticsService.getAnalyticsSummary(
                { dateFrom: "2024-06-01T00:00:00.000Z", dateTo: "2024-06-01T23:59:59.999Z" },
                mockLogger,
            );

            const success = expectSuccess(result);
            expect(success.data!.dailySales).toHaveLength(1);
            const day = success.data!.dailySales[0];
            expect(day.totalSales).toBe(600);
            expect(day.totalOrders).toBe(3);
            expect(day.totalExpenses).toBe(125);
            expect(day.profit).toBe(475);
        });

        test("should handle database error gracefully", async () => {
            prismaMock.$queryRaw.mockRejectedValue(new Error("DB connection failed"));

            const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

            expect(result.success).toBe(false);
            expect(mockLogger.error).toHaveBeenCalled();
        });

        test("should pass 6 parallel queries to $queryRaw", async () => {
            mockAnalyticsQueries();

            await AnalyticsService.getAnalyticsSummary({}, mockLogger);

            expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(6);
        });
    });
});
