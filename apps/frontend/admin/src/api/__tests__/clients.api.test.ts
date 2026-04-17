import { beforeEach, describe, expect, test, vi } from "vitest";

import type { QueryFunctionContext } from "@tanstack/react-query";

interface MockEdenResponse {
    data: Record<string, unknown> | null;
    error: Record<string, unknown> | null;
}

const { mockGet, mockGetById, mockPost, mockPut, mockDelete, mockRestorePost } = vi.hoisted(() => ({
    mockGet: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { count: 0, users: [] } },
                error: null,
            }),
    ),
    mockGetById: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1, fullname: "Test" } },
                error: null,
            }),
    ),
    mockPost: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1, fullname: "New Client" } },
                error: null,
            }),
    ),
    mockPut: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1, fullname: "Updated" } },
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
    mockRestorePost: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1, deletedAt: null } },
                error: null,
            }),
    ),
}));

vi.mock("@/api/client", () => ({
    api: {
        api: {
            private: {
                users: Object.assign(
                    (_params: { id: number }) => ({
                        get: mockGetById,
                        put: mockPut,
                        delete: mockDelete,
                        restore: { post: mockRestorePost },
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
    addClientToListCache,
    clientDetailQueryOptions,
    clientKeys,
    clientsListQueryOptions,
    createClientFn,
    deleteClientFn,
    removeClientFromListCache,
    restoreClientFn,
    restoreClientInListCache,
    updateClientFn,
    updateClientInListCache,
} from "../clients.api";

import type { AdminUserItem } from "@jahonbozor/schemas/src/users";

type ListCtx = QueryFunctionContext<
    readonly ["clients", "list", Record<string, unknown> | undefined]
>;
type DetailCtx = QueryFunctionContext<readonly ["clients", "detail", number]>;

interface ClientsListCache {
    count: number;
    users: AdminUserItem[];
}

interface ClientsInfiniteCache {
    pages: ClientsListCache[];
    pageParams: number[];
}

const client = (id: number, extra: Partial<AdminUserItem> = {}): AdminUserItem =>
    ({ id, fullname: `Client ${id}`, ...extra }) as unknown as AdminUserItem;

describe("clients.api", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("clientKeys", () => {
        test("should have correct all key", () => {
            expect(clientKeys.all).toEqual(["clients"]);
        });

        test("should have correct list key with params", () => {
            const params = { page: 1, limit: 20 };
            expect(clientKeys.list(params)).toEqual(["clients", "list", params]);
        });

        test("should have correct list key without params", () => {
            expect(clientKeys.list()).toEqual(["clients", "list", undefined]);
        });

        test("should have correct detail key", () => {
            expect(clientKeys.detail(5)).toEqual(["clients", "detail", 5]);
        });

        test("list key should extend all key", () => {
            expect(clientKeys.list()[0]).toBe(clientKeys.all[0]);
        });
    });

    describe("clientsListQueryOptions", () => {
        test("should have correct queryKey", () => {
            const options = clientsListQueryOptions();
            expect([...options.queryKey]).toEqual(["clients", "list", undefined]);
        });

        test("queryFn should call api with defaults", async () => {
            const options = clientsListQueryOptions();
            await options.queryFn!({} as ListCtx);
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

        test("queryFn should merge custom params", async () => {
            const options = clientsListQueryOptions({
                limit: 100,
                includeDeleted: true,
            });
            await options.queryFn!({} as ListCtx);
            expect(mockGet).toHaveBeenCalledWith({
                query: {
                    page: 1,
                    limit: 100,
                    searchQuery: "",
                    sortBy: "id",
                    sortOrder: "asc",
                    includeDeleted: true,
                },
            });
        });

        test("queryFn should return data on success", async () => {
            mockGet.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: { count: 2, users: [{ id: 1 }, { id: 2 }] },
                },
                error: null,
            });
            const result = await clientsListQueryOptions().queryFn!({} as ListCtx);
            expect(result).toMatchObject({ count: 2 });
        });

        test("queryFn should throw on error", async () => {
            mockGet.mockResolvedValueOnce({
                data: null,
                error: { status: 500 },
            });
            await expect(clientsListQueryOptions().queryFn!({} as ListCtx)).rejects.toBeDefined();
        });

        test("queryFn should throw when success is false", async () => {
            mockGet.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(clientsListQueryOptions().queryFn!({} as ListCtx)).rejects.toThrow(
                "Request failed",
            );
        });
    });

    describe("clientDetailQueryOptions", () => {
        test("should be enabled when id > 0", () => {
            expect(clientDetailQueryOptions(1).enabled).toBe(true);
        });

        test("should be disabled when id is 0", () => {
            expect(clientDetailQueryOptions(0).enabled).toBe(false);
        });

        test("should be disabled when id is negative", () => {
            expect(clientDetailQueryOptions(-1).enabled).toBe(false);
        });

        test("queryFn should return client on success", async () => {
            mockGetById.mockResolvedValueOnce({
                data: { success: true, data: { id: 3, fullname: "Client" } },
                error: null,
            });
            const result = await clientDetailQueryOptions(3).queryFn!({} as DetailCtx);
            expect(result).toMatchObject({ id: 3 });
        });
    });

    describe("createClientFn", () => {
        test("should call api with body", async () => {
            const body = {
                fullname: "New",
                phone: null,
                telegramId: null,
                photo: null,
                language: "uz" as const,
            };
            await createClientFn(body);
            expect(mockPost).toHaveBeenCalledWith(body);
        });

        test("should throw on error", async () => {
            mockPost.mockResolvedValueOnce({
                data: null,
                error: { status: 400 },
            });
            await expect(
                createClientFn({
                    fullname: "",
                    phone: null,
                    telegramId: null,
                    photo: null,
                    language: "uz",
                }),
            ).rejects.toBeDefined();
        });
    });

    describe("updateClientFn", () => {
        test("should call api with id and body", async () => {
            await updateClientFn({ id: 1, fullname: "Updated" });
            expect(mockPut).toHaveBeenCalledWith({ fullname: "Updated" });
        });

        test("should throw when success is false", async () => {
            mockPut.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(updateClientFn({ id: 1, fullname: "X" })).rejects.toThrow(
                "Request failed",
            );
        });
    });

    describe("deleteClientFn", () => {
        test("should call delete endpoint", async () => {
            await deleteClientFn(5);
            expect(mockDelete).toHaveBeenCalled();
        });
    });

    describe("restoreClientFn", () => {
        test("should call restore endpoint", async () => {
            await restoreClientFn(5);
            expect(mockRestorePost).toHaveBeenCalled();
        });

        test("should throw on error", async () => {
            mockRestorePost.mockResolvedValueOnce({
                data: null,
                error: { status: 404 },
            });
            await expect(restoreClientFn(999)).rejects.toBeDefined();
        });
    });

    describe("addClientToListCache", () => {
        test("appends client to regular list cache and increments count (CreateOrderDialog)", () => {
            const cache: ClientsListCache = { count: 2, users: [client(1), client(2)] };
            const result = addClientToListCache(cache, client(3));
            expect(result.count).toBe(3);
            expect(result.users).toHaveLength(3);
            expect(result.users[2]).toMatchObject({ id: 3 });
        });

        test("does not mutate source list cache", () => {
            const cache: ClientsListCache = { count: 1, users: [client(1)] };
            const snapshot = { count: cache.count, users: [...cache.users] };
            addClientToListCache(cache, client(2));
            expect(cache.count).toBe(snapshot.count);
            expect(cache.users).toEqual(snapshot.users);
        });

        test("appends client to last page of infinite list cache (users page)", () => {
            const cache: ClientsInfiniteCache = {
                pages: [
                    { count: 2, users: [client(1), client(2)] },
                    { count: 1, users: [client(3)] },
                ],
                pageParams: [1, 2],
            };
            const result = addClientToListCache(cache, client(4));
            expect(result.pages[0].users).toHaveLength(2);
            expect(result.pages[1].users).toHaveLength(2);
            expect(result.pages[1].count).toBe(2);
            expect(result.pages[1].users[1]).toMatchObject({ id: 4 });
        });

        test("returns infinite cache unchanged when pages are empty", () => {
            const cache: ClientsInfiniteCache = { pages: [], pageParams: [] };
            expect(addClientToListCache(cache, client(1))).toBe(cache);
        });

        test("returns undefined when cache is undefined", () => {
            expect(addClientToListCache(undefined, client(1))).toBeUndefined();
        });
    });

    describe("updateClientInListCache", () => {
        test("replaces matching client in regular list cache", () => {
            const cache: ClientsListCache = {
                count: 2,
                users: [client(1, { fullname: "Old" }), client(2)],
            };
            const result = updateClientInListCache(cache, client(1, { fullname: "New" }));
            expect(result.users[0]).toMatchObject({ fullname: "New" });
            expect(result.users[1]).toMatchObject({ id: 2 });
            expect(result.count).toBe(2);
        });

        test("leaves unrelated clients untouched in regular list cache", () => {
            const cache: ClientsListCache = { count: 2, users: [client(1), client(2)] };
            const result = updateClientInListCache(cache, client(99, { fullname: "Ghost" }));
            expect(result.users).toEqual(cache.users);
        });

        test("replaces client across pages of infinite list cache", () => {
            const cache: ClientsInfiniteCache = {
                pages: [
                    { count: 1, users: [client(1, { fullname: "Old" })] },
                    { count: 1, users: [client(2)] },
                ],
                pageParams: [1, 2],
            };
            const result = updateClientInListCache(cache, client(1, { fullname: "New" }));
            expect(result.pages[0].users[0]).toMatchObject({ fullname: "New" });
            expect(result.pages[1].users[0]).toMatchObject({ id: 2 });
        });
    });

    describe("removeClientFromListCache", () => {
        test("filters client out of regular list cache and decrements count", () => {
            const cache: ClientsListCache = { count: 2, users: [client(1), client(2)] };
            const result = removeClientFromListCache(cache, 1);
            expect(result.users).toHaveLength(1);
            expect(result.users[0]).toMatchObject({ id: 2 });
            expect(result.count).toBe(1);
        });

        test("leaves regular list cache unchanged when id is not present", () => {
            const cache: ClientsListCache = { count: 2, users: [client(1), client(2)] };
            const result = removeClientFromListCache(cache, 999);
            expect(result.users).toHaveLength(2);
            expect(result.count).toBe(2);
        });

        test("filters client out of infinite list cache", () => {
            const cache: ClientsInfiniteCache = {
                pages: [
                    { count: 2, users: [client(1), client(2)] },
                    { count: 1, users: [client(3)] },
                ],
                pageParams: [1, 2],
            };
            const result = removeClientFromListCache(cache, 3);
            expect(result.pages[1].users).toHaveLength(0);
            expect(result.pages[1].count).toBe(0);
            expect(result.pages[0].users).toHaveLength(2);
        });

        test("count does not go below zero", () => {
            const cache: ClientsListCache = { count: 0, users: [client(1)] };
            const result = removeClientFromListCache(cache, 1);
            expect(result.count).toBe(0);
        });
    });

    describe("restoreClientInListCache", () => {
        test("clears deletedAt on matching client in regular list cache", () => {
            const deletedClient = client(1, {
                deletedAt: "2026-01-01T00:00:00Z",
            } as Partial<AdminUserItem>);
            const cache: ClientsListCache = { count: 1, users: [deletedClient] };
            const restored = client(1, { deletedAt: null } as Partial<AdminUserItem>);
            const result = restoreClientInListCache(cache, restored);
            expect(result.users[0]).toMatchObject({ id: 1, deletedAt: null });
        });

        test("clears deletedAt in infinite list cache", () => {
            const deletedClient = client(1, {
                deletedAt: "2026-01-01T00:00:00Z",
            } as Partial<AdminUserItem>);
            const cache: ClientsInfiniteCache = {
                pages: [{ count: 1, users: [deletedClient] }],
                pageParams: [1],
            };
            const restored = client(1, { deletedAt: null } as Partial<AdminUserItem>);
            const result = restoreClientInListCache(cache, restored);
            expect(result.pages[0].users[0]).toMatchObject({ id: 1, deletedAt: null });
        });
    });
});
