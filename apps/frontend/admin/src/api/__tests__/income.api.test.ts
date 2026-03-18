import { beforeEach, describe, expect, test, vi } from "vitest";

import type { QueryFunctionContext } from "@tanstack/react-query";

interface MockEdenResponse {
    data: Record<string, unknown> | null;
    error: Record<string, unknown> | null;
}

const { mockHistoryGet, mockInventoryPost } = vi.hoisted(() => ({
    mockHistoryGet: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { count: 0, history: [] } },
                error: null,
            }),
    ),
    mockInventoryPost: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1, operation: "INVENTORY_ADD" } },
                error: null,
            }),
    ),
}));

vi.mock("@/api/client", () => ({
    api: {
        api: {
            private: {
                products: Object.assign(
                    (_params: { id: number }) => ({
                        inventory: { post: mockInventoryPost },
                    }),
                    {
                        history: { get: mockHistoryGet },
                    },
                ),
            },
        },
    },
}));

import { createIncomeFn, incomeKeys, incomeListQueryOptions } from "../income.api";

type ListCtx = QueryFunctionContext<
    readonly ["income", "list", Record<string, unknown> | undefined]
>;

describe("income.api", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("incomeKeys", () => {
        test("should have correct all key", () => {
            expect(incomeKeys.all).toEqual(["income"]);
        });

        test("should have correct list key with params", () => {
            const params = { page: 1 };
            expect(incomeKeys.list(params)).toEqual(["income", "list", params]);
        });

        test("should have correct list key without params", () => {
            expect(incomeKeys.list()).toEqual(["income", "list", undefined]);
        });
    });

    describe("incomeListQueryOptions", () => {
        test("should have correct queryKey", () => {
            const options = incomeListQueryOptions();
            expect([...options.queryKey]).toEqual(["income", "list", undefined]);
        });

        test("queryFn should call api with INVENTORY_ADD operation", async () => {
            const options = incomeListQueryOptions();
            await options.queryFn!({} as ListCtx);
            expect(mockHistoryGet).toHaveBeenCalledWith({
                query: {
                    operation: "INVENTORY_ADD",
                    page: 1,
                    limit: 20,
                    searchQuery: "",
                    sortBy: "id",
                    sortOrder: "asc",
                    staffId: undefined,
                    productId: undefined,
                    dateFrom: undefined,
                    dateTo: undefined,
                },
            });
        });

        test("queryFn should merge custom params", async () => {
            const options = incomeListQueryOptions({
                page: 2,
                limit: 50,
                productId: 7,
            });
            await options.queryFn!({} as ListCtx);
            expect(mockHistoryGet).toHaveBeenCalledWith({
                query: expect.objectContaining({
                    page: 2,
                    limit: 50,
                    productId: 7,
                }),
            });
        });

        test("queryFn should return data on success", async () => {
            mockHistoryGet.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: { count: 5, history: [{ id: 1 }] },
                },
                error: null,
            });
            const result = await incomeListQueryOptions().queryFn!({} as ListCtx);
            expect(result).toMatchObject({ count: 5 });
        });

        test("queryFn should throw on error", async () => {
            mockHistoryGet.mockResolvedValueOnce({
                data: null,
                error: { status: 500 },
            });
            await expect(incomeListQueryOptions().queryFn!({} as ListCtx)).rejects.toBeDefined();
        });

        test("queryFn should throw when success is false", async () => {
            mockHistoryGet.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(incomeListQueryOptions().queryFn!({} as ListCtx)).rejects.toThrow(
                "Request failed",
            );
        });
    });

    describe("createIncomeFn", () => {
        test("should call inventory endpoint with correct body", async () => {
            await createIncomeFn({ productId: 5, quantity: 10 });
            expect(mockInventoryPost).toHaveBeenCalledWith({
                operation: "INVENTORY_ADD",
                quantity: 10,
                changeReason: null,
                createdAt: undefined,
            });
        });

        test("should pass changeReason when provided", async () => {
            await createIncomeFn({
                productId: 1,
                quantity: 5,
                changeReason: "Restock",
            });
            expect(mockInventoryPost).toHaveBeenCalledWith(
                expect.objectContaining({ changeReason: "Restock" }),
            );
        });

        test("should throw on error", async () => {
            mockInventoryPost.mockResolvedValueOnce({
                data: null,
                error: { status: 400 },
            });
            await expect(createIncomeFn({ productId: 1, quantity: 0 })).rejects.toBeDefined();
        });

        test("should throw when success is false", async () => {
            mockInventoryPost.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(createIncomeFn({ productId: 1, quantity: 10 })).rejects.toThrow(
                "Request failed",
            );
        });
    });
});
