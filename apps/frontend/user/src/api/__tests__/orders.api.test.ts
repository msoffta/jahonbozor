import { describe, test, expect, beforeEach, mock } from "bun:test";
import { useCartStore } from "@/stores/cart.store";

const mockOrder = {
    id: 1,
    paymentType: "CASH",
    status: "NEW",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    items: [],
};

const mockGet = mock(() =>
    Promise.resolve({
        data: { success: true, data: { count: 1, orders: [mockOrder] } },
        error: null,
    }),
);

const mockDetailGet = mock(() =>
    Promise.resolve({
        data: { success: true, data: mockOrder },
        error: null,
    }),
);

const mockPost = mock(() =>
    Promise.resolve({
        data: { success: true, data: mockOrder },
        error: null,
    }),
);

mock.module("@/lib/api-client", () => ({
    api: {
        api: {
            public: {
                orders: Object.assign(
                    (_params: { id: number }) => ({ get: mockDetailGet }),
                    { get: mockGet, post: mockPost },
                ),
            },
        },
    },
}));

import { orderKeys, ordersListOptions, orderDetailOptions } from "../orders.api";

describe("orders.api", () => {
    beforeEach(() => {
        useCartStore.setState({ items: [] });
        mock.restore();
    });

    describe("orderKeys", () => {
        test("should have correct all key", () => {
            expect(orderKeys.all).toEqual(["orders"]);
        });

        test("should have correct list key with params", () => {
            const params = { page: 1, status: "NEW" };
            expect(orderKeys.list(params)).toEqual(["orders", "list", params]);
        });

        test("should have correct detail key", () => {
            expect(orderKeys.detail(3)).toEqual(["orders", "detail", 3]);
        });
    });

    describe("ordersListOptions", () => {
        test("should have correct queryKey with params", () => {
            const params = { page: 2, status: "ACCEPTED" as const };
            const options = ordersListOptions(params);
            expect([...options.queryKey]).toEqual(["orders", "list", params]);
        });

        test("queryFn should call api with correct query params", async () => {
            const params = { page: 3, limit: 10, status: "NEW" as const };
            const options = ordersListOptions(params);
            await options.queryFn!({} as never);

            expect(mockGet).toHaveBeenCalledWith({
                query: {
                    page: 3,
                    limit: 10,
                    searchQuery: "",
                    status: "NEW",
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
                    status: undefined,
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
