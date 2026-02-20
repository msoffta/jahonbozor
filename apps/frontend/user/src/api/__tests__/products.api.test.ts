import { describe, test, expect, beforeEach, mock } from "bun:test";

const mockProduct = {
    id: 1,
    name: "Prod1",
    price: 100,
    categoryId: 1,
    remaining: 10,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
};

const mockGet = mock(() =>
    Promise.resolve({
        data: { success: true, data: { count: 1, products: [mockProduct] } },
        error: null,
    }),
);

const mockDetailGet = mock(() =>
    Promise.resolve({
        data: { success: true, data: mockProduct },
        error: null,
    }),
);

mock.module("@/lib/api-client", () => ({
    api: {
        api: {
            public: {
                products: Object.assign(
                    (_params: { id: number }) => ({ get: mockDetailGet }),
                    { get: mockGet },
                ),
            },
        },
    },
}));

import { productKeys, productsListOptions, productDetailOptions } from "../products.api";

describe("products.api", () => {
    beforeEach(() => {
        mock.restore();
    });

    describe("productKeys", () => {
        test("should have correct all key", () => {
            expect(productKeys.all).toEqual(["products"]);
        });

        test("should have correct list key with params", () => {
            const params = { page: 2, searchQuery: "test" };
            expect(productKeys.list(params)).toEqual(["products", "list", params]);
        });

        test("should have correct detail key", () => {
            expect(productKeys.detail(5)).toEqual(["products", "detail", 5]);
        });
    });

    describe("productsListOptions", () => {
        test("should have correct queryKey with params", () => {
            const params = { page: 1, limit: 20, searchQuery: "hello" };
            const options = productsListOptions(params);
            expect([...options.queryKey]).toEqual(["products", "list", params]);
        });

        test("queryFn should call api with correct query params", async () => {
            const params = { page: 2, limit: 10, searchQuery: "test", categoryIds: [3, 5] };
            const options = productsListOptions(params);
            await options.queryFn!({} as never);

            expect(mockGet).toHaveBeenCalledWith({
                query: {
                    page: 2,
                    limit: 10,
                    searchQuery: "test",
                    includeDeleted: false,
                    categoryIds: "3,5",
                },
            });
        });

        test("queryFn should use defaults for missing params", async () => {
            const options = productsListOptions({});
            await options.queryFn!({} as never);

            expect(mockGet).toHaveBeenCalledWith({
                query: {
                    page: 1,
                    limit: 20,
                    searchQuery: "",
                    includeDeleted: false,
                    categoryIds: undefined,
                },
            });
        });

        test("queryFn should return unwrapped data", async () => {
            const options = productsListOptions({});
            const result = await options.queryFn!({} as never);

            expect(result).toEqual({ count: 1, products: [mockProduct] });
        });

        test("queryFn should throw on error", async () => {
            mockGet.mockReturnValueOnce(
                Promise.resolve({ data: null, error: new Error("fail") }) as never,
            );

            const options = productsListOptions({});
            await expect(options.queryFn!({} as never)).rejects.toThrow();
        });
    });

    describe("productDetailOptions", () => {
        test("should have correct queryKey", () => {
            const options = productDetailOptions(7);
            expect([...options.queryKey]).toEqual(["products", "detail", 7]);
        });

        test("queryFn should return product data", async () => {
            const options = productDetailOptions(1);
            const result = await options.queryFn!({} as never);

            expect(result).toEqual(mockProduct);
        });
    });
});
