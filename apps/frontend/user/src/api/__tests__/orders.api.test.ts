import { beforeEach, describe, expect, test, vi } from "vitest";

import { useCartStore } from "@/stores/cart.store";

const mockOrder = {
    id: 1,
    paymentType: "CASH",
    comment: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    items: [],
};

const { mockGet, mockDetailGet, mockPost } = vi.hoisted(() => ({
    mockGet: vi.fn(() =>
        Promise.resolve({
            data: { success: true, data: { count: 1, orders: [mockOrder] } },
            error: null,
        }),
    ),
    mockDetailGet: vi.fn(() =>
        Promise.resolve({
            data: { success: true, data: mockOrder },
            error: null,
        }),
    ),
    mockPost: vi.fn(() =>
        Promise.resolve({
            data: { success: true, data: mockOrder },
            error: null,
        }),
    ),
}));

vi.mock("@/lib/api-client", () => ({
    api: {
        api: {
            public: {
                orders: Object.assign((_params: { id: number }) => ({ get: mockDetailGet }), {
                    get: mockGet,
                    post: mockPost,
                }),
            },
        },
    },
}));

import { orderDetailOptions, orderKeys, ordersListOptions } from "../orders.api";

describe("orders.api", () => {
    beforeEach(() => {
        useCartStore.setState({ items: [] });
    });

    describe("orderKeys", () => {
        test("should have correct all key", () => {
            expect(orderKeys.all).toEqual(["orders"]);
        });

        test("should have correct list key with params", () => {
            const params = { page: 1 };
            expect(orderKeys.list(params)).toEqual(["orders", "list", params]);
        });

        test("should have correct detail key", () => {
            expect(orderKeys.detail(3)).toEqual(["orders", "detail", 3]);
        });
    });

    describe("ordersListOptions", () => {
        test("should have correct queryKey with params", () => {
            const params = { page: 2 };
            const options = ordersListOptions(params);
            expect([...options.queryKey]).toEqual(["orders", "list", params]);
        });

        test("queryFn should call api with correct query params", async () => {
            const params = { page: 3, limit: 10 };
            const options = ordersListOptions(params);
            await options.queryFn!({} as never);

            expect(mockGet).toHaveBeenCalledWith({
                query: {
                    page: 3,
                    limit: 10,
                    searchQuery: "",
                    sortBy: "id",
                    sortOrder: "asc",
                },
            });
        });

        test("queryFn should use defaults for missing params", async () => {
            const options = ordersListOptions({});
            await options.queryFn!({} as never);

            expect(mockGet).toHaveBeenCalledWith({
                query: {
                    page: 1,
                    limit: 20,
                    searchQuery: "",
                    sortBy: "id",
                    sortOrder: "asc",
                },
            });
        });

        test("queryFn should return unwrapped data", async () => {
            const options = ordersListOptions({});
            const result = await options.queryFn!({} as never);

            expect(result).toEqual({ count: 1, orders: [mockOrder] });
        });

        test("queryFn should throw on error", async () => {
            mockGet.mockReturnValueOnce(
                Promise.resolve({ data: null, error: new Error("fail") }) as never,
            );

            const options = ordersListOptions({});
            await expect(options.queryFn!({} as never)).rejects.toThrow();
        });
    });

    describe("orderDetailOptions", () => {
        test("should have correct queryKey", () => {
            const options = orderDetailOptions(5);
            expect([...options.queryKey]).toEqual(["orders", "detail", 5]);
        });

        test("queryFn should return order data", async () => {
            const options = orderDetailOptions(1);
            const result = await options.queryFn!({} as never);

            expect(result).toEqual(mockOrder);
        });

        test("queryFn should throw on unsuccessful response", async () => {
            mockDetailGet.mockReturnValueOnce(
                Promise.resolve({ data: { success: false }, error: null }) as never,
            );

            const options = orderDetailOptions(1);
            await expect(options.queryFn!({} as never)).rejects.toThrow("Request failed");
        });
    });
});
