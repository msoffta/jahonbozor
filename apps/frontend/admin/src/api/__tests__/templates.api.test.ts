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
                data: { success: true, data: { count: 0, templates: [] } },
                error: null,
            }),
    ),
    mockGetById: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1, name: "Test Template" } },
                error: null,
            }),
    ),
    mockPost: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1, name: "New Template" } },
                error: null,
            }),
    ),
    mockPatch: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1, name: "Updated" } },
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
                "broadcast-templates": Object.assign(
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
    createTemplateFn,
    deleteTemplateFn,
    templateDetailQueryOptions,
    templateKeys,
    templatesListQueryOptions,
    updateTemplateFn,
} from "../templates.api";

type ListCtx = QueryFunctionContext<
    readonly ["templates", "list", Record<string, unknown> | undefined]
>;
type DetailCtx = QueryFunctionContext<readonly ["templates", "detail", number]>;

describe("templates.api", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("templateKeys", () => {
        test("should have correct all key", () => {
            expect(templateKeys.all).toEqual(["templates"]);
        });

        test("should have correct list key with params", () => {
            const params = { page: 2, limit: 10 };
            expect(templateKeys.list(params)).toEqual(["templates", "list", params]);
        });

        test("should have correct list key without params", () => {
            expect(templateKeys.list()).toEqual(["templates", "list", undefined]);
        });

        test("should have correct detail key", () => {
            expect(templateKeys.detail(5)).toEqual(["templates", "detail", 5]);
        });

        test("list key should extend all key", () => {
            expect(templateKeys.list()[0]).toBe(templateKeys.all[0]);
        });

        test("detail key should extend all key", () => {
            expect(templateKeys.detail(1)[0]).toBe(templateKeys.all[0]);
        });
    });

    describe("templatesListQueryOptions", () => {
        test("should have correct queryKey", () => {
            const options = templatesListQueryOptions();
            expect([...options.queryKey]).toEqual(["templates", "list", undefined]);
        });

        test("queryFn should call api with defaults", async () => {
            const options = templatesListQueryOptions();
            await options.queryFn!({} as ListCtx);
            expect(mockGet).toHaveBeenCalledWith({
                query: {
                    page: 1,
                    limit: 20,
                    searchQuery: "",
                    sortBy: "id",
                    sortOrder: "desc",
                },
            });
        });

        test("queryFn should merge custom params", async () => {
            const options = templatesListQueryOptions({
                page: 3,
                limit: 50,
                searchQuery: "welcome",
            });
            await options.queryFn!({} as ListCtx);
            expect(mockGet).toHaveBeenCalledWith({
                query: {
                    page: 3,
                    limit: 50,
                    searchQuery: "welcome",
                    sortBy: "id",
                    sortOrder: "desc",
                },
            });
        });

        test("queryFn should return data on success", async () => {
            mockGet.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        count: 2,
                        templates: [{ id: 1 }, { id: 2 }],
                    },
                },
                error: null,
            });
            const result = await templatesListQueryOptions().queryFn!({} as ListCtx);
            expect(result).toMatchObject({ count: 2 });
        });

        test("queryFn should throw on error", async () => {
            mockGet.mockResolvedValueOnce({
                data: null,
                error: { status: 500 },
            });
            await expect(templatesListQueryOptions().queryFn!({} as ListCtx)).rejects.toBeDefined();
        });

        test("queryFn should throw when success is false", async () => {
            mockGet.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(templatesListQueryOptions().queryFn!({} as ListCtx)).rejects.toThrow(
                "Request failed",
            );
        });
    });

    describe("templateDetailQueryOptions", () => {
        test("should be enabled when id > 0", () => {
            expect(templateDetailQueryOptions(1).enabled).toBe(true);
        });

        test("should be disabled when id is 0", () => {
            expect(templateDetailQueryOptions(0).enabled).toBe(false);
        });

        test("should be disabled when id is negative", () => {
            expect(templateDetailQueryOptions(-1).enabled).toBe(false);
        });

        test("queryFn should return template on success", async () => {
            mockGetById.mockResolvedValueOnce({
                data: { success: true, data: { id: 3, name: "Template 3" } },
                error: null,
            });
            const result = await templateDetailQueryOptions(3).queryFn!({} as DetailCtx);
            expect(result).toMatchObject({ id: 3, name: "Template 3" });
        });

        test("queryFn should throw on error", async () => {
            mockGetById.mockResolvedValueOnce({
                data: null,
                error: { status: 404 },
            });
            await expect(
                templateDetailQueryOptions(1).queryFn!({} as DetailCtx),
            ).rejects.toBeDefined();
        });

        test("queryFn should throw when success is false", async () => {
            mockGetById.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(templateDetailQueryOptions(1).queryFn!({} as DetailCtx)).rejects.toThrow(
                "Request failed",
            );
        });
    });

    describe("createTemplateFn", () => {
        test("should call api with body", async () => {
            const body = { name: "Welcome", content: "Hello!" };
            await createTemplateFn(body);
            expect(mockPost).toHaveBeenCalledWith(body);
        });

        test("should call api with full body including media and buttons", async () => {
            const body = {
                name: "Promo",
                content: "Check this out",
                media: [{ type: "photo" as const, url: "https://img.test/1.jpg" }],
                buttons: [{ text: "Visit", url: "https://example.com" }],
            };
            await createTemplateFn(body);
            expect(mockPost).toHaveBeenCalledWith(body);
        });

        test("should return created template on success", async () => {
            const result = await createTemplateFn({ name: "T", content: "C" });
            expect(result).toMatchObject({ id: 1, name: "New Template" });
        });

        test("should throw on error", async () => {
            mockPost.mockResolvedValueOnce({
                data: null,
                error: { status: 400 },
            });
            await expect(createTemplateFn({ name: "", content: "" })).rejects.toBeDefined();
        });

        test("should throw when success is false", async () => {
            mockPost.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(createTemplateFn({ name: "", content: "" })).rejects.toThrow(
                "Request failed",
            );
        });
    });

    describe("updateTemplateFn", () => {
        test("should call api with id and body", async () => {
            await updateTemplateFn({ id: 1, name: "Updated" });
            expect(mockPatch).toHaveBeenCalledWith({ name: "Updated" });
        });

        test("should call api with content update", async () => {
            await updateTemplateFn({ id: 2, content: "New content" });
            expect(mockPatch).toHaveBeenCalledWith({ content: "New content" });
        });

        test("should throw on error", async () => {
            mockPatch.mockResolvedValueOnce({
                data: null,
                error: { status: 400 },
            });
            await expect(updateTemplateFn({ id: 1, name: "X" })).rejects.toBeDefined();
        });

        test("should throw when success is false", async () => {
            mockPatch.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(updateTemplateFn({ id: 1, name: "X" })).rejects.toThrow("Request failed");
        });
    });

    describe("deleteTemplateFn", () => {
        test("should call delete endpoint", async () => {
            await deleteTemplateFn(5);
            expect(mockDelete).toHaveBeenCalled();
        });

        test("should throw on error", async () => {
            mockDelete.mockResolvedValueOnce({
                data: null,
                error: { status: 404 },
            });
            await expect(deleteTemplateFn(999)).rejects.toBeDefined();
        });

        test("should throw when success is false", async () => {
            mockDelete.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(deleteTemplateFn(1)).rejects.toThrow("Request failed");
        });
    });
});
