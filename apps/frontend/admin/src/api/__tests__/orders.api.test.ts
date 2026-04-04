import { beforeEach, describe, expect, test, vi } from "vitest";

import type { QueryFunctionContext } from "@tanstack/react-query";

interface MockEdenResponse {
    data: Record<string, unknown> | null;
    error: Record<string, unknown> | null;
}

const { mockGet, mockGetById, mockPost, mockPatch, mockDelete } = vi.hoisted(() => ({
    mockGet: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { count: 0, orders: [] } },
                error: null,
            }),
    ),
    mockGetById: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1 } },
                error: null,
            }),
    ),
    mockPost: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1 } },
                error: null,
            }),
    ),
    mockPatch: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1 } },
                error: null,
            }),
    ),
    mockDelete: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1 } },
                error: null,
            }),
    ),
}));

vi.mock("@/api/client", () => ({
    api: {
        api: {
            private: {
                orders: Object.assign(
                    (_params: { id: number }) => ({
                        get: mockGetById,
                        patch: mockPatch,
                        delete: mockDelete,
                    }),
                    {
                        get: mockGet,
                        post: mockPost,
                    },
                ),
            },
        },
    },
}));

import {
    createOrderFn,
    deleteOrderFn,
    orderDetailQueryOptions,
    orderKeys,
    ordersListQueryOptions,
    updateOrderFn,
} from "../orders.api";

type ListCtx = QueryFunctionContext<
    readonly ["orders", "list", Record<string, unknown> | undefined]
>;
type DetailCtx = QueryFunctionContext<readonly ["orders", "detail", number]>;

describe("orders.api", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("orderKeys", () => {
        test("should have correct all key", () => {
            expect(orderKeys.all).toEqual(["orders"]);
        });

        test("should have correct list key with params", () => {
            const params = { page: 1, limit: 20 };
            expect(orderKeys.list(params)).toEqual(["orders", "list", params]);
        });

        test("should have correct list key without params", () => {
            expect(orderKeys.list()).toEqual(["orders", "list", undefined]);
        });

        test("should have correct detail key", () => {
            expect(orderKeys.detail(42)).toEqual(["orders", "detail", 42]);
        });

        test("list key should extend all key", () => {
            expect(orderKeys.list()[0]).toBe(orderKeys.all[0]);
        });
    });

    describe("ordersListQueryOptions", () => {
        test("should have correct queryKey", () => {
            const options = ordersListQueryOptions();
            expect([...options.queryKey]).toEqual(["orders", "list", undefined]);
        });

        test("should have a queryFn defined", () => {
            const options = ordersListQueryOptions();
            expect(typeof options.queryFn).toBe("function");
        });

        test("queryFn should call api", async () => {
            const options = ordersListQueryOptions();
            await options.queryFn!({} as ListCtx);
            expect(mockGet).toHaveBeenCalled();
        });

        test("queryFn should pass default params", async () => {
            const options = ordersListQueryOptions();
            await options.queryFn!({} as ListCtx);
            expect(mockGet).toHaveBeenCalledWith({
                query: { page: 1, limit: 20, searchQuery: "", sortBy: "id", sortOrder: "asc" },
            });
        });

        test("queryFn should merge custom params", async () => {
            const options = ordersListQueryOptions({ page: 2, limit: 50 });
            await options.queryFn!({} as ListCtx);
            expect(mockGet).toHaveBeenCalledWith({
                query: { page: 2, limit: 50, searchQuery: "", sortBy: "id", sortOrder: "asc" },
            });
        });

        test("queryFn should return data on success", async () => {
            mockGet.mockResolvedValueOnce({
                data: { success: true, data: { count: 3, orders: [{ id: 1 }] } },
                error: null,
            });
            const result = await ordersListQueryOptions().queryFn!({} as ListCtx);
            expect(result).toMatchObject({ count: 3 });
        });

        test("queryFn should throw on error", async () => {
            mockGet.mockResolvedValueOnce({
                data: null,
                error: { status: 500, message: "Server error" },
            });
            await expect(ordersListQueryOptions().queryFn!({} as ListCtx)).rejects.toBeDefined();
        });

        test("queryFn should throw when success is false", async () => {
            mockGet.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(ordersListQueryOptions().queryFn!({} as ListCtx)).rejects.toThrow(
                "Request failed",
            );
        });
    });

    describe("orderDetailQueryOptions", () => {
        test("should be enabled when id > 0", () => {
            expect(orderDetailQueryOptions(1).enabled).toBe(true);
        });

        test("should be disabled when id is 0", () => {
            expect(orderDetailQueryOptions(0).enabled).toBe(false);
        });

        test("should be disabled when id is negative", () => {
            expect(orderDetailQueryOptions(-1).enabled).toBe(false);
        });

        test("queryFn should return order on success", async () => {
            mockGetById.mockResolvedValueOnce({
                data: { success: true, data: { id: 7 } },
                error: null,
            });
            const result = await orderDetailQueryOptions(7).queryFn!({} as DetailCtx);
            expect(result).toMatchObject({ id: 7 });
        });
    });

    describe("createOrderFn", () => {
        test("should call api with body", async () => {
            const body = {
                userId: null,
                paymentType: "CASH" as const,
                items: [{ productId: 1, quantity: 2, price: 100 }],
            };
            await createOrderFn(body);
            expect(mockPost).toHaveBeenCalledWith(body);
        });

        test("should return data on success", async () => {
            mockPost.mockResolvedValueOnce({
                data: { success: true, data: { id: 10 } },
                error: null,
            });
            const result = await createOrderFn({
                userId: null,
                paymentType: "CASH",
                items: [{ productId: 1, quantity: 1, price: 50 }],
            });
            expect(result).toMatchObject({ id: 10 });
        });

        test("should throw on error", async () => {
            mockPost.mockResolvedValueOnce({
                data: null,
                error: { status: 400 },
            });
            await expect(
                createOrderFn({
                    userId: null,
                    paymentType: "CASH",
                    items: [],
                }),
            ).rejects.toBeDefined();
        });

        test("should accept null productId for items without a product", async () => {
            const body = {
                userId: null,
                paymentType: "CASH" as const,
                items: [{ productId: null, quantity: 3, price: 150 }],
            };
            await createOrderFn(body);
            expect(mockPost).toHaveBeenCalledWith(body);
        });

        test("should accept mixed items (product + null-product)", async () => {
            const body = {
                userId: null,
                paymentType: "CASH" as const,
                items: [
                    { productId: 1, quantity: 2, price: 100 },
                    { productId: null, quantity: 5, price: 200 },
                ],
            };
            await createOrderFn(body);
            expect(mockPost).toHaveBeenCalledWith(body);
        });
    });

    describe("updateOrderFn", () => {
        test("should call api with id and body", async () => {
            await updateOrderFn({ id: 1, paymentType: "CASH" });
            expect(mockPatch).toHaveBeenCalledWith({ paymentType: "CASH" });
        });

        test("should throw when success is false", async () => {
            mockPatch.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(updateOrderFn({ id: 1, paymentType: "DEBT" })).rejects.toThrow(
                "Request failed",
            );
        });

        test("should accept items with null productId (bind later)", async () => {
            await updateOrderFn({
                id: 1,
                items: [{ productId: null, quantity: 3, price: 150 }],
            });
            expect(mockPatch).toHaveBeenCalledWith({
                items: [{ productId: null, quantity: 3, price: 150 }],
            });
        });

        test("should accept items binding a product to previously null item", async () => {
            await updateOrderFn({
                id: 1,
                items: [{ productId: 5, quantity: 3, price: 150 }],
            });
            expect(mockPatch).toHaveBeenCalledWith({
                items: [{ productId: 5, quantity: 3, price: 150 }],
            });
        });
    });

    describe("deleteOrderFn", () => {
        test("should call delete endpoint", async () => {
            await deleteOrderFn(5);
            expect(mockDelete).toHaveBeenCalled();
        });

        test("should throw on error", async () => {
            mockDelete.mockResolvedValueOnce({
                data: null,
                error: { status: 404 },
            });
            await expect(deleteOrderFn(999)).rejects.toBeDefined();
        });
    });
});
