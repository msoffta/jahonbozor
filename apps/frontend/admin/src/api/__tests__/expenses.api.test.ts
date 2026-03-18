import { beforeEach, describe, expect, test, vi } from "vitest";

import type { QueryFunctionContext } from "@tanstack/react-query";

interface MockEdenResponse {
    data: Record<string, unknown> | null;
    error: Record<string, unknown> | null;
}

type ListQueryFnContext = QueryFunctionContext<
    readonly ["expenses", "list", Record<string, unknown> | undefined]
>;
type DetailQueryFnContext = QueryFunctionContext<readonly ["expenses", "detail", number]>;

const { mockGet, mockGetById, mockPost, mockPatch, mockDelete, mockRestorePost } = vi.hoisted(
    () => ({
        mockGet: vi.fn(
            (): Promise<MockEdenResponse> =>
                Promise.resolve({
                    data: {
                        success: true,
                        data: {
                            count: 2,
                            expenses: [
                                {
                                    id: 1,
                                    name: "Office supplies",
                                    amount: 50000,
                                    description: null,
                                    expenseDate: "2026-01-15",
                                    staffId: 1,
                                },
                                {
                                    id: 2,
                                    name: "Transport",
                                    amount: 25000,
                                    description: "Taxi",
                                    expenseDate: "2026-01-16",
                                    staffId: 1,
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
                            name: "Office supplies",
                            amount: 50000,
                            description: null,
                            expenseDate: "2026-01-15",
                            staffId: 1,
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
                            name: "New expense",
                            amount: 10000,
                            description: "Test",
                            expenseDate: "2026-01-20",
                            staffId: 1,
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
                        data: { id: 1, name: "Updated expense", amount: 60000 },
                    },
                    error: null,
                }),
        ),
        mockDelete: vi.fn(
            (): Promise<MockEdenResponse> =>
                Promise.resolve({
                    data: {
                        success: true,
                        data: { id: 1, name: "Office supplies", deletedAt: "2026-01-20" },
                    },
                    error: null,
                }),
        ),
        mockRestorePost: vi.fn(
            (): Promise<MockEdenResponse> =>
                Promise.resolve({
                    data: {
                        success: true,
                        data: { id: 1, name: "Office supplies", deletedAt: null },
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
                expenses: Object.assign(
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
    createExpenseFn,
    deleteExpenseFn,
    expenseDetailQueryOptions,
    expenseKeys,
    expensesListQueryOptions,
    restoreExpenseFn,
    updateExpenseFn,
} from "../expenses.api";

describe("expenses.api", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // --- Query Keys ---

    describe("expenseKeys", () => {
        test("should have correct all key", () => {
            expect(expenseKeys.all).toEqual(["expenses"]);
        });

        test("should have correct list key with params", () => {
            const params = { page: 1, limit: 20 };
            expect(expenseKeys.list(params)).toEqual(["expenses", "list", params]);
        });

        test("should have correct list key without params", () => {
            expect(expenseKeys.list()).toEqual(["expenses", "list", undefined]);
        });

        test("should have correct detail key", () => {
            expect(expenseKeys.detail(42)).toEqual(["expenses", "detail", 42]);
        });

        test("list key should extend all key", () => {
            const listKey = expenseKeys.list();
            expect(listKey[0]).toBe(expenseKeys.all[0]);
        });

        test("detail key should extend all key", () => {
            const detailKey = expenseKeys.detail(1);
            expect(detailKey[0]).toBe(expenseKeys.all[0]);
        });
    });

    // --- List Query Options ---

    describe("expensesListQueryOptions", () => {
        test("should have correct queryKey", () => {
            const options = expensesListQueryOptions();
            expect([...options.queryKey]).toEqual(["expenses", "list", undefined]);
        });

        test("should have correct queryKey with params", () => {
            const params = { page: 2, limit: 50 };
            const options = expensesListQueryOptions(params);
            expect([...options.queryKey]).toEqual(["expenses", "list", params]);
        });

        test("should have a queryFn defined", () => {
            const options = expensesListQueryOptions();
            expect(typeof options.queryFn).toBe("function");
        });

        test("queryFn should call api.api.private.expenses.get", async () => {
            const options = expensesListQueryOptions();
            await options.queryFn!({} as ListQueryFnContext);
            expect(mockGet).toHaveBeenCalled();
        });

        test("queryFn should pass default params when none provided", async () => {
            const options = expensesListQueryOptions();
            await options.queryFn!({} as ListQueryFnContext);
            expect(mockGet).toHaveBeenCalledWith({
                query: {
                    page: 1,
                    limit: 20,
                    searchQuery: "",
                    sortBy: "id",
                    sortOrder: "asc",
                    includeDeleted: false,
                },
            });
        });

        test("queryFn should merge custom params over defaults", async () => {
            const options = expensesListQueryOptions({ page: 3, limit: 50, staffId: 1 });
            await options.queryFn!({} as ListQueryFnContext);
            expect(mockGet).toHaveBeenCalledWith({
                query: {
                    page: 3,
                    limit: 50,
                    searchQuery: "",
                    sortBy: "id",
                    sortOrder: "asc",
                    includeDeleted: false,
                    staffId: 1,
                },
            });
        });

        test("queryFn should return data.data on success", async () => {
            mockGet.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        count: 1,
                        expenses: [{ id: 1, name: "Test" }],
                    },
                },
                error: null,
            });

            const options = expensesListQueryOptions();
            const result = await options.queryFn!({} as ListQueryFnContext);
            expect(result).toMatchObject({ count: 1, expenses: [{ id: 1, name: "Test" }] });
        });

        test("queryFn should throw on error", async () => {
            mockGet.mockResolvedValueOnce({
                data: null,
                error: { status: 500, message: "Internal error" },
            });

            const options = expensesListQueryOptions();
            await expect(options.queryFn!({} as ListQueryFnContext)).rejects.toBeDefined();
        });

        test("queryFn should throw when data.success is false", async () => {
            mockGet.mockResolvedValueOnce({
                data: { success: false, error: "Something went wrong" },
                error: null,
            });

            const options = expensesListQueryOptions();
            await expect(options.queryFn!({} as ListQueryFnContext)).rejects.toThrow(
                "Request failed",
            );
        });
    });

    // --- Detail Query Options ---

    describe("expenseDetailQueryOptions", () => {
        test("should have correct queryKey with id", () => {
            const options = expenseDetailQueryOptions(5);
            expect([...options.queryKey]).toEqual(["expenses", "detail", 5]);
        });

        test("should be enabled when id > 0", () => {
            const options = expenseDetailQueryOptions(1);
            expect(options.enabled).toBe(true);
        });

        test("should be disabled when id is 0", () => {
            const options = expenseDetailQueryOptions(0);
            expect(options.enabled).toBe(false);
        });

        test("should be disabled when id is negative", () => {
            const options = expenseDetailQueryOptions(-1);
            expect(options.enabled).toBe(false);
        });

        test("queryFn should return single expense on success", async () => {
            mockGetById.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: { id: 7, name: "Single Expense", amount: 15000 },
                },
                error: null,
            });

            const options = expenseDetailQueryOptions(7);
            const result = await options.queryFn!({} as DetailQueryFnContext);
            expect(result).toMatchObject({ id: 7, name: "Single Expense" });
        });

        test("queryFn should throw on error", async () => {
            mockGetById.mockResolvedValueOnce({
                data: null,
                error: { status: 404, message: "Not found" },
            });

            const options = expenseDetailQueryOptions(999);
            await expect(options.queryFn!({} as DetailQueryFnContext)).rejects.toBeDefined();
        });

        test("queryFn should throw when data.success is false", async () => {
            mockGetById.mockResolvedValueOnce({
                data: { success: false, error: "Not found" },
                error: null,
            });

            const options = expenseDetailQueryOptions(999);
            await expect(options.queryFn!({} as DetailQueryFnContext)).rejects.toThrow(
                "Request failed",
            );
        });
    });

    // --- Mutations ---

    describe("createExpenseFn", () => {
        test("should call api.api.private.expenses.post with body", async () => {
            const body = {
                name: "New",
                amount: 10000,
                description: null,
                expenseDate: "2026-01-20",
            };
            await createExpenseFn(body);
            expect(mockPost).toHaveBeenCalledWith(body);
        });

        test("should return data.data on success", async () => {
            mockPost.mockResolvedValueOnce({
                data: { success: true, data: { id: 10, name: "Created" } },
                error: null,
            });

            const result = await createExpenseFn({
                name: "Created",
                amount: 5000,
                description: null,
                expenseDate: "2026-01-20",
            });
            expect(result).toMatchObject({ id: 10, name: "Created" });
        });

        test("should throw on error", async () => {
            mockPost.mockResolvedValueOnce({
                data: null,
                error: { status: 400, message: "Validation error" },
            });

            await expect(
                createExpenseFn({ name: "", amount: 0, description: null, expenseDate: "" }),
            ).rejects.toBeDefined();
        });

        test("should throw when data.success is false", async () => {
            mockPost.mockResolvedValueOnce({
                data: { success: false, error: "Duplicate" },
                error: null,
            });

            await expect(
                createExpenseFn({
                    name: "Dup",
                    amount: 100,
                    description: null,
                    expenseDate: "2026-01-20",
                }),
            ).rejects.toThrow("Request failed");
        });
    });

    describe("updateExpenseFn", () => {
        test("should call api.api.private.expenses({ id }).patch with body", async () => {
            await updateExpenseFn({ id: 1, name: "Updated", amount: 60000 });
            expect(mockPatch).toHaveBeenCalledWith({ name: "Updated", amount: 60000 });
        });

        test("should return data.data on success", async () => {
            mockPatch.mockResolvedValueOnce({
                data: { success: true, data: { id: 1, name: "Updated" } },
                error: null,
            });

            const result = await updateExpenseFn({ id: 1, name: "Updated" });
            expect(result).toMatchObject({ id: 1, name: "Updated" });
        });

        test("should throw on error", async () => {
            mockPatch.mockResolvedValueOnce({
                data: null,
                error: { status: 404, message: "Not found" },
            });

            await expect(updateExpenseFn({ id: 999, name: "X" })).rejects.toBeDefined();
        });
    });

    describe("deleteExpenseFn", () => {
        test("should call api.api.private.expenses({ id }).delete", async () => {
            await deleteExpenseFn(5);
            expect(mockDelete).toHaveBeenCalled();
        });

        test("should return data.data on success", async () => {
            mockDelete.mockResolvedValueOnce({
                data: { success: true, data: { id: 5, deletedAt: "2026-01-20" } },
                error: null,
            });

            const result = await deleteExpenseFn(5);
            expect(result).toMatchObject({ id: 5 });
        });

        test("should throw on error", async () => {
            mockDelete.mockResolvedValueOnce({
                data: null,
                error: { status: 404, message: "Not found" },
            });

            await expect(deleteExpenseFn(999)).rejects.toBeDefined();
        });
    });

    describe("restoreExpenseFn", () => {
        test("should call api.api.private.expenses({ id }).restore.post", async () => {
            await restoreExpenseFn(3);
            expect(mockRestorePost).toHaveBeenCalled();
        });

        test("should return data.data on success", async () => {
            mockRestorePost.mockResolvedValueOnce({
                data: { success: true, data: { id: 3, deletedAt: null } },
                error: null,
            });

            const result = await restoreExpenseFn(3);
            expect(result).toMatchObject({ id: 3, deletedAt: null });
        });

        test("should throw on error", async () => {
            mockRestorePost.mockResolvedValueOnce({
                data: null,
                error: { status: 404, message: "Not found" },
            });

            await expect(restoreExpenseFn(999)).rejects.toBeDefined();
        });
    });
});
