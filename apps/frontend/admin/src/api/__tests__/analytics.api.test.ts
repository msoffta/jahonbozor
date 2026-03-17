import { beforeEach, describe, expect, test, vi } from "vitest";

import type { QueryFunctionContext } from "@tanstack/react-query";

interface MockEdenResponse {
    data: Record<string, unknown> | null;
    error: Record<string, unknown> | null;
}

const { mockSummaryGet } = vi.hoisted(() => ({
    mockSummaryGet: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: {
                    success: true,
                    data: {
                        overview: {
                            totalSales: 1000,
                            totalExpenses: 500,
                            profit: 500,
                            ordersCount: 10,
                        },
                        dailySales: [],
                        topProducts: [],
                        categoryBreakdown: [],
                    },
                },
                error: null,
            }),
    ),
}));

vi.mock("@/api/client", () => ({
    api: {
        api: {
            private: {
                analytics: {
                    summary: { get: mockSummaryGet },
                },
            },
        },
    },
}));

import { analyticsKeys, analyticsSummaryQueryOptions } from "../analytics.api";

type SummaryCtx = QueryFunctionContext<
    readonly ["analytics", "summary", { dateFrom?: string; dateTo?: string } | undefined]
>;

describe("analytics.api", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("analyticsKeys", () => {
        test("should have correct all key", () => {
            expect(analyticsKeys.all).toEqual(["analytics"]);
        });

        test("should have correct summary key with params", () => {
            const params = { dateFrom: "2024-01-01" };
            expect(analyticsKeys.summary(params)).toEqual(["analytics", "summary", params]);
        });

        test("should have correct summary key without params", () => {
            expect(analyticsKeys.summary()).toEqual(["analytics", "summary", undefined]);
        });

        test("summary key should extend all key", () => {
            expect(analyticsKeys.summary()[0]).toBe(analyticsKeys.all[0]);
        });
    });

    describe("analyticsSummaryQueryOptions", () => {
        test("should have correct queryKey without params", () => {
            const options = analyticsSummaryQueryOptions();
            expect([...options.queryKey]).toEqual(["analytics", "summary", undefined]);
        });

        test("should have correct queryKey with params", () => {
            const params = { dateFrom: "2024-01-01", dateTo: "2024-12-31" };
            const options = analyticsSummaryQueryOptions(params);
            expect([...options.queryKey]).toEqual(["analytics", "summary", params]);
        });

        test("queryFn should call api with empty query when no params", async () => {
            const options = analyticsSummaryQueryOptions();
            await options.queryFn!({} as SummaryCtx);
            expect(mockSummaryGet).toHaveBeenCalledWith({ query: {} });
        });

        test("queryFn should pass date params", async () => {
            const params = { dateFrom: "2024-06-01", dateTo: "2024-06-30" };
            const options = analyticsSummaryQueryOptions(params);
            await options.queryFn!({} as SummaryCtx);
            expect(mockSummaryGet).toHaveBeenCalledWith({ query: params });
        });

        test("queryFn should return summary data on success", async () => {
            mockSummaryGet.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        overview: {
                            totalSales: 5000,
                            totalExpenses: 2000,
                            profit: 3000,
                            ordersCount: 25,
                        },
                        dailySales: [{ date: "2024-01-01", total: 100 }],
                        topProducts: [],
                        categoryBreakdown: [],
                    },
                },
                error: null,
            });
            const result = await analyticsSummaryQueryOptions().queryFn!({} as SummaryCtx);
            expect(result).toMatchObject({
                overview: { totalSales: 5000, profit: 3000 },
            });
        });

        test("queryFn should throw on error", async () => {
            mockSummaryGet.mockResolvedValueOnce({
                data: null,
                error: { status: 500, message: "Server error" },
            });
            await expect(
                analyticsSummaryQueryOptions().queryFn!({} as SummaryCtx),
            ).rejects.toBeDefined();
        });

        test("queryFn should throw when success is false", async () => {
            mockSummaryGet.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(analyticsSummaryQueryOptions().queryFn!({} as SummaryCtx)).rejects.toThrow(
                "Request failed",
            );
        });
    });
});
