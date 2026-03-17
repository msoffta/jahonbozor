import { describe, test, expect, vi } from "vitest";

const mockProduct = {
    id: 1,
    name: "Prod1",
    price: 100,
    categoryId: 1,
    remaining: 10,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
};

const { mockGet, mockDetailGet } = vi.hoisted(() => ({
    mockGet: vi.fn(() =>
        Promise.resolve({
            data: { success: true, data: { count: 1, products: [mockProduct] } },
            error: null,
        }),
    ),
    mockDetailGet: vi.fn(() =>
        Promise.resolve({
            data: { success: true, data: mockProduct },
            error: null,
        }),
    ),
}));

vi.mock("@/lib/api-client", () => ({
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

import { productKeys, productsListOptions, productsInfiniteOptions, productDetailOptions } from "../products.api";

describe("products.api", () => {
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

    describe("productsInfiniteOptions", () => {
        test("should have correct queryKey with infinite flag", () => {
            const params = { limit: 20, searchQuery: "test" };
            const options = productsInfiniteOptions(params);
            expect([...options.queryKey]).toEqual(["products", "list", { ...params, infinite: true }]);
        });

        test("should have initialPageParam of 1", () => {
            const options = productsInfiniteOptions({});
            expect(options.initialPageParam).toBe(1);
        });

        test("queryFn should call api with pageParam", async () => {
            const options = productsInfiniteOptions({ limit: 10, categoryIds: [1, 2] });
            await options.queryFn!({ pageParam: 3 } as never);

            expect(mockGet).toHaveBeenCalledWith({
                query: {
                    page: 3,
                    limit: 10,
                    searchQuery: "",
                    includeDeleted: false,
                    categoryIds: "1,2",
                },
            });
        });

        test("getNextPageParam should return next page when more data exists", () => {
            const options = productsInfiniteOptions({ limit: 10 });
            const lastPage = { count: 30, products: [] };
            const result = options.getNextPageParam!(lastPage as never, [] as never, 1, [] as never);
            expect(result).toBe(2);
        });

        test("getNextPageParam should return undefined on last page", () => {
            const options = productsInfiniteOptions({ limit: 10 });
            const lastPage = { count: 20, products: [] };
            const result = options.getNextPageParam!(lastPage as never, [] as never, 2, [] as never);
            expect(result).toBeUndefined();
        });

        test("getNextPageParam should return undefined when exactly at boundary", () => {
            const options = productsInfiniteOptions({ limit: 20 });
            const lastPage = { count: 20, products: [] };
            const result = options.getNextPageParam!(lastPage as never, [] as never, 1, [] as never);
            expect(result).toBeUndefined();
        });

        test("queryFn should throw on error", async () => {
            mockGet.mockReturnValueOnce(
                Promise.resolve({ data: null, error: new Error("network") }) as never,
            );
            const options = productsInfiniteOptions({});
            await expect(options.queryFn!({ pageParam: 1 } as never)).rejects.toThrow("network");
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
