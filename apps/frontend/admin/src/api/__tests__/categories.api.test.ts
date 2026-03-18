import { beforeEach, describe, expect, test, vi } from "vitest";

import type { QueryFunctionContext } from "@tanstack/react-query";

interface MockEdenResponse {
    data: Record<string, unknown> | null;
    error: Record<string, unknown> | null;
}

const { mockGet, mockPost } = vi.hoisted(() => ({
    mockGet: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { count: 0, categories: [] } },
                error: null,
            }),
    ),
    mockPost: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1, name: "New Category" } },
                error: null,
            }),
    ),
}));

vi.mock("@/api/client", () => ({
    api: {
        api: {
            private: {
                categories: Object.assign(() => ({}), {
                    get: mockGet,
                    post: mockPost,
                }),
            },
        },
    },
}));

import { categoriesListQueryOptions, categoryKeys, createCategoryFn } from "../categories.api";

type ListCtx = QueryFunctionContext<
    readonly ["categories", "list", Record<string, unknown> | undefined]
>;

describe("categories.api", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("categoryKeys", () => {
        test("should have correct all key", () => {
            expect(categoryKeys.all).toEqual(["categories"]);
        });

        test("should have correct list key with params", () => {
            const params = { limit: 50 };
            expect(categoryKeys.list(params)).toEqual(["categories", "list", params]);
        });

        test("should have correct list key without params", () => {
            expect(categoryKeys.list()).toEqual(["categories", "list", undefined]);
        });

        test("list key should extend all key", () => {
            expect(categoryKeys.list()[0]).toBe(categoryKeys.all[0]);
        });
    });

    describe("categoriesListQueryOptions", () => {
        test("should have correct queryKey", () => {
            const options = categoriesListQueryOptions();
            expect([...options.queryKey]).toEqual(["categories", "list", undefined]);
        });

        test("queryFn should call api with defaults including depth", async () => {
            const options = categoriesListQueryOptions();
            await options.queryFn!({} as ListCtx);
            expect(mockGet).toHaveBeenCalledWith({
                query: {
                    page: 1,
                    limit: 100,
                    searchQuery: "",
                    sortBy: "id",
                    sortOrder: "asc",
                    depth: 1,
                },
            });
        });

        test("queryFn should merge custom params", async () => {
            const options = categoriesListQueryOptions({ limit: 50 });
            await options.queryFn!({} as ListCtx);
            expect(mockGet).toHaveBeenCalledWith({
                query: {
                    page: 1,
                    limit: 50,
                    searchQuery: "",
                    sortBy: "id",
                    sortOrder: "asc",
                    depth: 1,
                },
            });
        });

        test("queryFn should return data on success", async () => {
            mockGet.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: { count: 3, categories: [{ id: 1, name: "Cat" }] },
                },
                error: null,
            });
            const result = await categoriesListQueryOptions().queryFn!({} as ListCtx);
            expect(result).toMatchObject({ count: 3 });
        });

        test("queryFn should throw on error", async () => {
            mockGet.mockResolvedValueOnce({
                data: null,
                error: { status: 500 },
            });
            await expect(
                categoriesListQueryOptions().queryFn!({} as ListCtx),
            ).rejects.toBeDefined();
        });

        test("queryFn should throw when success is false", async () => {
            mockGet.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(categoriesListQueryOptions().queryFn!({} as ListCtx)).rejects.toThrow(
                "Request failed",
            );
        });
    });

    describe("createCategoryFn", () => {
        test("should call api with body", async () => {
            const body = { name: "Electronics" };
            await createCategoryFn(body);
            expect(mockPost).toHaveBeenCalledWith(body);
        });

        test("should accept parentId", async () => {
            const body = { name: "Phones", parentId: 1 };
            await createCategoryFn(body);
            expect(mockPost).toHaveBeenCalledWith(body);
        });

        test("should return created category", async () => {
            mockPost.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: { id: 5, name: "Created" },
                },
                error: null,
            });
            const result = await createCategoryFn({ name: "Created" });
            expect(result).toMatchObject({ id: 5 });
        });

        test("should throw on error", async () => {
            mockPost.mockResolvedValueOnce({
                data: null,
                error: { status: 400 },
            });
            await expect(createCategoryFn({ name: "" })).rejects.toBeDefined();
        });

        test("should throw when success is false", async () => {
            mockPost.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(createCategoryFn({ name: "Dup" })).rejects.toThrow("Request failed");
        });
    });
});
