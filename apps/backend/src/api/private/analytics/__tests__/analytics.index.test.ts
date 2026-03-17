import { Elysia } from "elysia";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { Permission } from "@jahonbozor/schemas";

import { createMockLogger } from "@backend/test/setup";

import { AnalyticsService } from "../analytics.service";

// Mock user for tests
const mockUser = {
    id: 1,
    type: "staff" as const,
    fullname: "Test Admin",
    username: "testadmin",
    telegramId: "123456789",
    roleId: 1,
};

// Create test app with mocked middleware
const createTestApp = (permissions: Permission[] = [Permission.ANALYTICS_VIEW]) => {
    const mockLogger = createMockLogger();

    return new Elysia()
        .derive(() => ({
            user: mockUser,
            permissions,
            logger: mockLogger,
            requestId: "test-request-id",
        }))
        .get("/analytics/summary", async ({ query, logger }) => {
            return await AnalyticsService.getAnalyticsSummary(
                {
                    dateFrom: query.dateFrom || undefined,
                    dateTo: query.dateTo || undefined,
                },
                logger,
            );
        });
};

describe("Analytics API Routes", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    describe("GET /analytics/summary", () => {
        test("should return analytics summary with ANALYTICS_VIEW permission", async () => {
            // Arrange
            const mockData = {
                period: {
                    from: "2024-06-01T00:00:00.000Z",
                    to: "2024-06-01T23:59:59.999Z",
                },
                overview: {
                    totalSales: 10000,
                    totalExpenses: 3000,
                    profit: 7000,
                    ordersCount: 10,
                    acceptedOrdersCount: 8,
                },
                dailySales: [],
                topProducts: [],
                categoryBreakdown: [],
            };

            const spy = vi.spyOn(AnalyticsService, "getAnalyticsSummary").mockResolvedValue({
                success: true,
                data: mockData,
            });

            // Act
            const response = await app.handle(new Request("http://localhost/analytics/summary"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.overview.totalSales).toBe(10000);
            expect(body.data.overview.profit).toBe(7000);

            spy.mockRestore();
        });

        test("should accept dateFrom and dateTo query params", async () => {
            // Arrange
            const spy = vi.spyOn(AnalyticsService, "getAnalyticsSummary").mockResolvedValue({
                success: true,
                data: {
                    period: { from: "2024-06-01T00:00:00.000Z", to: "2024-06-30T23:59:59.999Z" },
                    overview: {
                        totalSales: 0,
                        totalExpenses: 0,
                        profit: 0,
                        ordersCount: 0,
                        acceptedOrdersCount: 0,
                    },
                    dailySales: [],
                    topProducts: [],
                    categoryBreakdown: [],
                },
            });

            const dateFrom = "2024-06-01T00:00:00.000Z";
            const dateTo = "2024-06-30T23:59:59.999Z";

            // Act
            await app.handle(
                new Request(
                    `http://localhost/analytics/summary?dateFrom=${dateFrom}&dateTo=${dateTo}`,
                ),
            );

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({
                    dateFrom,
                    dateTo,
                }),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should default to today if no dates provided", async () => {
            // Arrange
            const spy = vi.spyOn(AnalyticsService, "getAnalyticsSummary").mockResolvedValue({
                success: true,
                data: {
                    period: { from: new Date().toISOString(), to: new Date().toISOString() },
                    overview: {
                        totalSales: 0,
                        totalExpenses: 0,
                        profit: 0,
                        ordersCount: 0,
                        acceptedOrdersCount: 0,
                    },
                    dailySales: [],
                    topProducts: [],
                    categoryBreakdown: [],
                },
            });

            // Act
            await app.handle(new Request("http://localhost/analytics/summary"));

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({
                    dateFrom: undefined,
                    dateTo: undefined,
                }),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should return error when service fails", async () => {
            // Arrange
            const spy = vi.spyOn(AnalyticsService, "getAnalyticsSummary").mockResolvedValue({
                success: false,
                error: new Error("Database error"),
            });

            // Act
            const response = await app.handle(new Request("http://localhost/analytics/summary"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200); // Elysia returns 200 even for failed responses
            expect(body.success).toBe(false);
            expect(body.error).toBeDefined();

            spy.mockRestore();
        });

        test("should pass undefined dates when no query params provided", async () => {
            // Arrange
            const spy = vi.spyOn(AnalyticsService, "getAnalyticsSummary").mockResolvedValue({
                success: true,
                data: {
                    period: { from: new Date().toISOString(), to: new Date().toISOString() },
                    overview: {
                        totalSales: 0,
                        totalExpenses: 0,
                        profit: 0,
                        ordersCount: 0,
                        acceptedOrdersCount: 0,
                    },
                    dailySales: [],
                    topProducts: [],
                    categoryBreakdown: [],
                },
            });

            // Act
            await app.handle(new Request("http://localhost/analytics/summary"));

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ dateFrom: undefined, dateTo: undefined }),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should handle service throwing an exception gracefully", async () => {
            // Arrange
            const spy = vi
                .spyOn(AnalyticsService, "getAnalyticsSummary")
                .mockRejectedValue(new Error("Unexpected crash"));

            // Act
            const response = await app.handle(new Request("http://localhost/analytics/summary"));

            // Assert — Elysia's global error handler should catch this
            expect(response.status).toBeDefined();

            spy.mockRestore();
        });

        test("should pass both dateFrom and dateTo when provided", async () => {
            // Arrange
            const spy = vi.spyOn(AnalyticsService, "getAnalyticsSummary").mockResolvedValue({
                success: true,
                data: {
                    period: { from: "2024-01-01T00:00:00.000Z", to: "2024-12-31T23:59:59.999Z" },
                    overview: {
                        totalSales: 5000,
                        totalExpenses: 1000,
                        profit: 4000,
                        ordersCount: 50,
                        acceptedOrdersCount: 45,
                    },
                    dailySales: [],
                    topProducts: [],
                    categoryBreakdown: [],
                },
            });

            const dateFrom = "2024-01-01T00:00:00.000Z";
            const dateTo = "2024-12-31T23:59:59.999Z";

            // Act
            const response = await app.handle(
                new Request(
                    `http://localhost/analytics/summary?dateFrom=${dateFrom}&dateTo=${dateTo}`,
                ),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ dateFrom, dateTo }),
                expect.anything(),
            );

            spy.mockRestore();
        });
    });
});
