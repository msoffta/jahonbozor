import { beforeEach, describe, expect, test, vi } from "vitest";

import type { QueryFunctionContext } from "@tanstack/react-query";

interface MockEdenResponse {
    data: Record<string, unknown> | null;
    error: Record<string, unknown> | null;
}

type ListQueryFnContext = QueryFunctionContext<
    readonly ["products", "list", Record<string, unknown> | undefined]
>;
type DetailQueryFnContext = QueryFunctionContext<readonly ["products", "detail", number]>;

const { mockGet, mockGetById, mockPost, mockPatch, mockDelete, mockRestorePost } = vi.hoisted(
    () => ({
        mockGet: vi.fn(
            (): Promise<MockEdenResponse> =>
                Promise.resolve({
                    data: {
                        success: true,
                        data: {
                            count: 2,
                            products: [
                                {
                                    id: 1,
                                    name: "Product A",
                                    price: 1000,
                                    costprice: 500,
                                    categoryId: 1,
                                    remaining: 10,
                                },
                                {
                                    id: 2,
                                    name: "Product B",
                                    price: 2000,
                                    costprice: 800,
                                    categoryId: 2,
                                    remaining: 5,
                                },
                            ],
                        },
                    },
                    error: null,
                }),
        ),
        mockGetById: vi.fn(
            (): Promise<MockEdenResponse> =>
                Promise.resolve({
                    data: {
                        success: true,
                        data: {
                            id: 1,
                            name: "Product A",
                            price: 1000,
                            costprice: 500,
                            categoryId: 1,
                            remaining: 10,
                        },
                    },
                    error: null,
                }),
        ),
        mockPost: vi.fn(
            (): Promise<MockEdenResponse> =>
                Promise.resolve({
                    data: {
                        success: true,
                        data: {
                            id: 3,
                            name: "New Product",
                            price: 1500,
                            costprice: 700,
                            categoryId: 1,
                            remaining: 0,
                        },
                    },
                    error: null,
                }),
        ),
        mockPatch: vi.fn(
            (): Promise<MockEdenResponse> =>
                Promise.resolve({
                    data: {
                        success: true,
                        data: { id: 1, name: "Updated Product", price: 1200 },
                    },
                    error: null,
                }),
        ),
        mockDelete: vi.fn(
            (): Promise<MockEdenResponse> =>
                Promise.resolve({
                    data: {
                        success: true,
                        data: { id: 1, name: "Product A", deletedAt: "2026-01-01" },
                    },
                    error: null,
                }),
        ),
        mockRestorePost: vi.fn(
            (): Promise<MockEdenResponse> =>
                Promise.resolve({
                    data: {
                        success: true,
                        data: { id: 1, name: "Product A", deletedAt: null },
                    },
                    error: null,
                }),
        ),
    }),
);

vi.mock("@/api/client", () => ({
    api: {
        api: {
            private: {
                products: Object.assign(
                    (_params: { id: number }) => ({
                        get: mockGetById,
                        patch: mockPatch,
                        delete: mockDelete,
                        restore: { post: mockRestorePost },
                    }),
                    { get: mockGet, post: mockPost },
                ),
            },
        },
    },
}));

// --- Imports AFTER mocks ---
import {
    createProductFn,
    deleteProductFn,
    productDetailQueryOptions,
    productKeys,
    productsListQueryOptions,
    restoreProductFn,
    updateProductFn,
} from "../products.api";

describe("products.api", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // --- Query Keys ---

    describe("productKeys", () => {
        test("should have correct all key", () => {
            expect(productKeys.all).toEqual(["products"]);
        });

        test("should have correct list key with params", () => {
            const params = { page: 1, limit: 20 };
            expect(productKeys.list(params)).toEqual(["products", "list", params]);
        });

        test("should have correct list key without params", () => {
            expect(productKeys.list()).toEqual(["products", "list", undefined]);
        });

        test("should have correct detail key", () => {
            expect(productKeys.detail(42)).toEqual(["products", "detail", 42]);
        });

        test("list key should extend all key", () => {
            const listKey = productKeys.list();
            expect(listKey[0]).toBe(productKeys.all[0]);
        });

        test("detail key should extend all key", () => {
            const detailKey = productKeys.detail(1);
            expect(detailKey[0]).toBe(productKeys.all[0]);
        });
    });

    // --- List Query Options ---

    describe("productsListQueryOptions", () => {
        test("should have correct queryKey", () => {
            const options = productsListQueryOptions();
            expect([...options.queryKey]).toEqual(["products", "list", undefined]);
        });

        test("should have correct queryKey with params", () => {
            const params = { page: 2, limit: 50 };
            const options = productsListQueryOptions(params);
            expect([...options.queryKey]).toEqual(["products", "list", params]);
        });

        test("should have a queryFn defined", () => {
            const options = productsListQueryOptions();
            expect(typeof options.queryFn).toBe("function");
        });

        test("queryFn should call api.api.private.products.get", async () => {
            const options = productsListQueryOptions();
            await options.queryFn!({} as ListQueryFnContext);
            expect(mockGet).toHaveBeenCalled();
        });

        test("queryFn should pass default params when none provided", async () => {
            const options = productsListQueryOptions();
            await options.queryFn!({} as ListQueryFnContext);
            expect(mockGet).toHaveBeenCalledWith({
                query: { page: 1, limit: 100, searchQuery: "", includeDeleted: false },
            });
        });

        test("queryFn should merge custom params over defaults", async () => {
            const options = productsListQueryOptions({ page: 3, limit: 50, categoryIds: "1,2" });
            await options.queryFn!({} as ListQueryFnContext);
            expect(mockGet).toHaveBeenCalledWith({
                query: {
                    page: 3,
                    limit: 50,
                    searchQuery: "",
                    includeDeleted: false,
                    categoryIds: "1,2",
                },
            });
        });

        test("queryFn should return data.data on success", async () => {
            mockGet.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        count: 1,
                        products: [{ id: 1, name: "Test" }],
                    },
                },
                error: null,
            });

            const options = productsListQueryOptions();
            const result = await options.queryFn!({} as ListQueryFnContext);
            expect(result).toMatchObject({ count: 1, products: [{ id: 1, name: "Test" }] });
        });

        test("queryFn should throw on error", async () => {
            mockGet.mockResolvedValueOnce({
                data: null,
                error: { status: 500, message: "Internal error" },
            });

            const options = productsListQueryOptions();
            await expect(options.queryFn!({} as ListQueryFnContext)).rejects.toBeDefined();
        });

        test("queryFn should throw when data.success is false", async () => {
            mockGet.mockResolvedValueOnce({
                data: { success: false, error: "Something went wrong" },
                error: null,
            });

            const options = productsListQueryOptions();
            await expect(options.queryFn!({} as ListQueryFnContext)).rejects.toThrow(
                "Request failed",
            );
        });
    });

    // --- Detail Query Options ---

    describe("productDetailQueryOptions", () => {
        test("should have correct queryKey with id", () => {
            const options = productDetailQueryOptions(5);
            expect([...options.queryKey]).toEqual(["products", "detail", 5]);
        });

        test("should be enabled when id > 0", () => {
            const options = productDetailQueryOptions(1);
            expect(options.enabled).toBe(true);
        });

        test("should be disabled when id is 0", () => {
            const options = productDetailQueryOptions(0);
            expect(options.enabled).toBe(false);
        });

        test("should be disabled when id is negative", () => {
            const options = productDetailQueryOptions(-1);
            expect(options.enabled).toBe(false);
        });

        test("queryFn should return single product on success", async () => {
            mockGetById.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: { id: 7, name: "Single Product", price: 500 },
                },
                error: null,
            });

            const options = productDetailQueryOptions(7);
            const result = await options.queryFn!({} as DetailQueryFnContext);
            expect(result).toMatchObject({ id: 7, name: "Single Product" });
        });

        test("queryFn should throw on error", async () => {
            mockGetById.mockResolvedValueOnce({
                data: null,
                error: { status: 404, message: "Not found" },
            });

            const options = productDetailQueryOptions(999);
            await expect(options.queryFn!({} as DetailQueryFnContext)).rejects.toBeDefined();
        });

        test("queryFn should throw when data.success is false", async () => {
            mockGetById.mockResolvedValueOnce({
                data: { success: false, error: "Not found" },
                error: null,
            });

            const options = productDetailQueryOptions(999);
            await expect(options.queryFn!({} as DetailQueryFnContext)).rejects.toThrow(
                "Request failed",
            );
        });
    });

    // --- Mutations ---

    describe("createProductFn", () => {
        test("should call api.api.private.products.post with body", async () => {
            const body = { name: "New", price: 100, costprice: 50, categoryId: 1 };
            await createProductFn(body);
            expect(mockPost).toHaveBeenCalledWith({ ...body, remaining: 0 });
        });

        test("should return data.data on success", async () => {
            mockPost.mockResolvedValueOnce({
                data: { success: true, data: { id: 10, name: "Created" } },
                error: null,
            });

            const result = await createProductFn({
                name: "Created",
                price: 100,
                costprice: 50,
                categoryId: 1,
            });
            expect(result).toMatchObject({ id: 10, name: "Created" });
        });

        test("should throw on error", async () => {
            mockPost.mockResolvedValueOnce({
                data: null,
                error: { status: 400, message: "Validation error" },
            });

            await expect(
                createProductFn({ name: "", price: 0, costprice: 0, categoryId: 0 }),
            ).rejects.toBeDefined();
        });

        test("should throw when data.success is false", async () => {
            mockPost.mockResolvedValueOnce({
                data: { success: false, error: "Duplicate" },
                error: null,
            });

            await expect(
                createProductFn({ name: "Dup", price: 100, costprice: 50, categoryId: 1 }),
            ).rejects.toThrow("Request failed");
        });
    });

    describe("updateProductFn", () => {
        test("should call api.api.private.products({ id }).patch with body", async () => {
            await updateProductFn({ id: 1, name: "Updated", price: 200 });
            expect(mockPatch).toHaveBeenCalledWith({ name: "Updated", price: 200 });
        });

        test("should return data.data on success", async () => {
            mockPatch.mockResolvedValueOnce({
                data: { success: true, data: { id: 1, name: "Updated" } },
                error: null,
            });

            const result = await updateProductFn({ id: 1, name: "Updated" });
            expect(result).toMatchObject({ id: 1, name: "Updated" });
        });

        test("should throw on error", async () => {
            mockPatch.mockResolvedValueOnce({
                data: null,
                error: { status: 404, message: "Not found" },
            });

            await expect(updateProductFn({ id: 999, name: "X" })).rejects.toBeDefined();
        });
    });

    describe("deleteProductFn", () => {
        test("should call api.api.private.products({ id }).delete", async () => {
            await deleteProductFn(5);
            expect(mockDelete).toHaveBeenCalled();
        });

        test("should return data.data on success", async () => {
            mockDelete.mockResolvedValueOnce({
                data: { success: true, data: { id: 5, deletedAt: "2026-01-01" } },
                error: null,
            });

            const result = await deleteProductFn(5);
            expect(result).toMatchObject({ id: 5 });
        });

        test("should throw on error", async () => {
            mockDelete.mockResolvedValueOnce({
                data: null,
                error: { status: 404, message: "Not found" },
            });

            await expect(deleteProductFn(999)).rejects.toBeDefined();
        });
    });

    describe("restoreProductFn", () => {
        test("should call api.api.private.products({ id }).restore.post", async () => {
            await restoreProductFn(3);
            expect(mockRestorePost).toHaveBeenCalled();
        });

        test("should return data.data on success", async () => {
            mockRestorePost.mockResolvedValueOnce({
                data: { success: true, data: { id: 3, deletedAt: null } },
                error: null,
            });

            const result = await restoreProductFn(3);
            expect(result).toMatchObject({ id: 3, deletedAt: null });
        });

        test("should throw on error", async () => {
            mockRestorePost.mockResolvedValueOnce({
                data: null,
                error: { status: 404, message: "Not found" },
            });

            await expect(restoreProductFn(999)).rejects.toBeDefined();
        });
    });
});
