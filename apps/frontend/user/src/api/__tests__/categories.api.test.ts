import { describe, expect, test, vi } from "vitest";

const { mockGet } = vi.hoisted(() => ({
    mockGet: vi.fn(() =>
        Promise.resolve({
            data: { success: true, data: { categories: [{ id: 1, name: "Cat1", children: [] }] } },
            error: null,
        }),
    ),
}));

vi.mock("@/lib/api-client", () => ({
    api: {
        api: {
            public: {
                categories: { get: mockGet },
            },
        },
    },
}));

import { categoriesListOptions, categoryKeys } from "../categories.api";

describe("categories.api", () => {
    describe("categoryKeys", () => {
        test("should have correct all key", () => {
            expect(categoryKeys.all).toEqual(["categories"]);
        });

        test("should have correct list key", () => {
            expect(categoryKeys.list()).toEqual(["categories", "list"]);
        });

        test("should have correct detail key", () => {
            expect(categoryKeys.detail(5)).toEqual(["categories", "detail", 5]);
        });
    });

    describe("categoriesListOptions", () => {
        test("should have correct queryKey", () => {
            const options = categoriesListOptions();
            expect([...options.queryKey]).toEqual(["categories", "list"]);
        });

        test("should have 30 min staleTime", () => {
            const options = categoriesListOptions();
            expect(options.staleTime).toBe(1000 * 60 * 30);
        });

        test("queryFn should call api and return data", async () => {
            const options = categoriesListOptions();
            const result = await options.queryFn!({} as never);

            expect(mockGet).toHaveBeenCalled();
            expect(result).toEqual({ categories: [{ id: 1, name: "Cat1", children: [] }] });
        });

        test("queryFn should throw on error", async () => {
            mockGet.mockReturnValueOnce(
                Promise.resolve({ data: null, error: new Error("fail") }) as never,
            );

            const options = categoriesListOptions();
            await expect(options.queryFn!({} as never)).rejects.toThrow();
        });

        test("queryFn should throw on unsuccessful response", async () => {
            mockGet.mockReturnValueOnce(
                Promise.resolve({ data: { success: false }, error: null }) as never,
            );

            const options = categoriesListOptions();
            await expect(options.queryFn!({} as never)).rejects.toThrow("Request failed");
        });
    });
});
