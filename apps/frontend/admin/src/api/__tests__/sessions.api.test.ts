import { beforeEach, describe, expect, test, vi } from "vitest";

import type { QueryFunctionContext } from "@tanstack/react-query";

interface MockEdenResponse {
    data: Record<string, unknown> | null;
    error: Record<string, unknown> | null;
}

const {
    mockGet,
    mockGetById,
    mockDelete,
    mockQrStartPost,
    mockQrStatusGet,
    mockDisconnectPost,
    mockReconnectPost,
} = vi.hoisted(() => ({
    mockGet: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { count: 0, sessions: [] } },
                error: null,
            }),
    ),
    mockGetById: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1, name: "Test Session" } },
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
    mockQrStartPost: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { qrUrl: "https://qr.test", token: "abc123" } },
                error: null,
            }),
    ),
    mockQrStatusGet: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { status: "waiting" } },
                error: null,
            }),
    ),
    mockDisconnectPost: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1 } },
                error: null,
            }),
    ),
    mockReconnectPost: vi.fn(
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
                "telegram-sessions": Object.assign(
                    (_params: { id: number }) => ({
                        get: mockGetById,
                        delete: mockDelete,
                        disconnect: { post: mockDisconnectPost },
                        reconnect: { post: mockReconnectPost },
                    }),
                    {
                        get: mockGet,
                        qr: {
                            start: { post: mockQrStartPost },
                            status: { get: mockQrStatusGet },
                        },
                    },
                ),
            },
        },
    },
}));

import {
    deleteSessionFn,
    disconnectSessionFn,
    qrStatusQueryOptions,
    reconnectSessionFn,
    sessionDetailQueryOptions,
    sessionKeys,
    sessionsListQueryOptions,
    startQrLoginFn,
} from "../sessions.api";

type ListCtx = QueryFunctionContext<
    readonly ["sessions", "list", Record<string, unknown> | undefined]
>;
type DetailCtx = QueryFunctionContext<readonly ["sessions", "detail", number]>;
type QrStatusCtx = QueryFunctionContext<readonly ["sessions", "qr-status", string]>;

describe("sessions.api", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("sessionKeys", () => {
        test("should have correct all key", () => {
            expect(sessionKeys.all).toEqual(["sessions"]);
        });

        test("should have correct list key with params", () => {
            const params = { page: 2, limit: 10 };
            expect(sessionKeys.list(params)).toEqual(["sessions", "list", params]);
        });

        test("should have correct list key without params", () => {
            expect(sessionKeys.list()).toEqual(["sessions", "list", undefined]);
        });

        test("should have correct detail key", () => {
            expect(sessionKeys.detail(5)).toEqual(["sessions", "detail", 5]);
        });

        test("list key should extend all key", () => {
            expect(sessionKeys.list()[0]).toBe(sessionKeys.all[0]);
        });

        test("detail key should extend all key", () => {
            expect(sessionKeys.detail(1)[0]).toBe(sessionKeys.all[0]);
        });
    });

    describe("sessionsListQueryOptions", () => {
        test("should have correct queryKey", () => {
            const options = sessionsListQueryOptions();
            expect([...options.queryKey]).toEqual(["sessions", "list", undefined]);
        });

        test("queryFn should call api with defaults", async () => {
            const options = sessionsListQueryOptions();
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
            const options = sessionsListQueryOptions({
                page: 3,
                limit: 50,
                searchQuery: "test",
            });
            await options.queryFn!({} as ListCtx);
            expect(mockGet).toHaveBeenCalledWith({
                query: {
                    page: 3,
                    limit: 50,
                    searchQuery: "test",
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
                        sessions: [
                            { id: 1, name: "S1" },
                            { id: 2, name: "S2" },
                        ],
                    },
                },
                error: null,
            });
            const result = await sessionsListQueryOptions().queryFn!({} as ListCtx);
            expect(result).toMatchObject({ count: 2 });
        });

        test("queryFn should throw on error", async () => {
            mockGet.mockResolvedValueOnce({
                data: null,
                error: { status: 500 },
            });
            await expect(sessionsListQueryOptions().queryFn!({} as ListCtx)).rejects.toBeDefined();
        });

        test("queryFn should throw when success is false", async () => {
            mockGet.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(sessionsListQueryOptions().queryFn!({} as ListCtx)).rejects.toThrow(
                "Request failed",
            );
        });
    });

    describe("sessionDetailQueryOptions", () => {
        test("should be enabled when id > 0", () => {
            expect(sessionDetailQueryOptions(1).enabled).toBe(true);
        });

        test("should be disabled when id is 0", () => {
            expect(sessionDetailQueryOptions(0).enabled).toBe(false);
        });

        test("should be disabled when id is negative", () => {
            expect(sessionDetailQueryOptions(-1).enabled).toBe(false);
        });

        test("queryFn should return session on success", async () => {
            mockGetById.mockResolvedValueOnce({
                data: { success: true, data: { id: 3, name: "Session 3" } },
                error: null,
            });
            const result = await sessionDetailQueryOptions(3).queryFn!({} as DetailCtx);
            expect(result).toMatchObject({ id: 3, name: "Session 3" });
        });

        test("queryFn should throw on error", async () => {
            mockGetById.mockResolvedValueOnce({
                data: null,
                error: { status: 404 },
            });
            await expect(
                sessionDetailQueryOptions(1).queryFn!({} as DetailCtx),
            ).rejects.toBeDefined();
        });

        test("queryFn should throw when success is false", async () => {
            mockGetById.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(sessionDetailQueryOptions(1).queryFn!({} as DetailCtx)).rejects.toThrow(
                "Request failed",
            );
        });
    });

    describe("qrStatusQueryOptions", () => {
        test("should have correct queryKey", () => {
            const options = qrStatusQueryOptions("token123", true);
            expect([...options.queryKey]).toEqual(["sessions", "qr-status", "token123"]);
        });

        test("should be enabled when enabled=true", () => {
            expect(qrStatusQueryOptions("token", true).enabled).toBe(true);
        });

        test("should be disabled when enabled=false", () => {
            expect(qrStatusQueryOptions("token", false).enabled).toBe(false);
        });

        test("queryFn should call api with token", async () => {
            await qrStatusQueryOptions("abc", true).queryFn!({} as QrStatusCtx);
            expect(mockQrStatusGet).toHaveBeenCalledWith({
                query: { token: "abc" },
            });
        });

        test("queryFn should return data on success", async () => {
            mockQrStatusGet.mockResolvedValueOnce({
                data: { success: true, data: { status: "waiting" } },
                error: null,
            });
            const result = await qrStatusQueryOptions("t", true).queryFn!({} as QrStatusCtx);
            expect(result).toMatchObject({ status: "waiting" });
        });

        test("queryFn should throw on error", async () => {
            mockQrStatusGet.mockResolvedValueOnce({
                data: null,
                error: { status: 500 },
            });
            await expect(
                qrStatusQueryOptions("t", true).queryFn!({} as QrStatusCtx),
            ).rejects.toBeDefined();
        });

        test("queryFn should throw when success is false", async () => {
            mockQrStatusGet.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(
                qrStatusQueryOptions("t", true).queryFn!({} as QrStatusCtx),
            ).rejects.toThrow("Request failed");
        });

        test("refetchInterval should return 2000 when status is waiting", () => {
            const options = qrStatusQueryOptions("t", true);
            const refetchInterval = options.refetchInterval as (query: {
                state: { data?: { status: string } };
            }) => number | false;
            const result = refetchInterval({
                state: { data: { status: "waiting" } },
            });
            expect(result).toBe(2000);
        });

        test("refetchInterval should return false when status is not waiting", () => {
            const options = qrStatusQueryOptions("t", true);
            const refetchInterval = options.refetchInterval as (query: {
                state: { data?: { status: string } };
            }) => number | false;
            const result = refetchInterval({
                state: { data: { status: "connected" } },
            });
            expect(result).toBe(false);
        });

        test("refetchInterval should return false when data is undefined", () => {
            const options = qrStatusQueryOptions("t", true);
            const refetchInterval = options.refetchInterval as (query: {
                state: { data?: { status: string } };
            }) => number | false;
            const result = refetchInterval({
                state: { data: undefined },
            });
            expect(result).toBe(false);
        });
    });

    describe("startQrLoginFn", () => {
        test("should call api with body", async () => {
            const body = { name: "My Session", phone: "+1234567890", apiId: 12345, apiHash: "abc" };
            await startQrLoginFn(body);
            expect(mockQrStartPost).toHaveBeenCalledWith(body);
        });

        test("should return qrUrl and token on success", async () => {
            const result = await startQrLoginFn({
                name: "S",
                phone: "+1",
            });
            expect(result).toMatchObject({ qrUrl: "https://qr.test", token: "abc123" });
        });

        test("should throw on error", async () => {
            mockQrStartPost.mockResolvedValueOnce({
                data: null,
                error: { status: 400 },
            });
            await expect(startQrLoginFn({ name: "", phone: "" })).rejects.toBeDefined();
        });

        test("should throw when success is false", async () => {
            mockQrStartPost.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(startQrLoginFn({ name: "", phone: "" })).rejects.toThrow("Request failed");
        });
    });

    describe("disconnectSessionFn", () => {
        test("should call disconnect endpoint", async () => {
            await disconnectSessionFn(5);
            expect(mockDisconnectPost).toHaveBeenCalled();
        });

        test("should throw on error", async () => {
            mockDisconnectPost.mockResolvedValueOnce({
                data: null,
                error: { status: 500 },
            });
            await expect(disconnectSessionFn(1)).rejects.toBeDefined();
        });

        test("should throw when success is false", async () => {
            mockDisconnectPost.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(disconnectSessionFn(1)).rejects.toThrow("Request failed");
        });
    });

    describe("reconnectSessionFn", () => {
        test("should call reconnect endpoint", async () => {
            await reconnectSessionFn(5);
            expect(mockReconnectPost).toHaveBeenCalled();
        });

        test("should throw on error", async () => {
            mockReconnectPost.mockResolvedValueOnce({
                data: null,
                error: { status: 500 },
            });
            await expect(reconnectSessionFn(1)).rejects.toBeDefined();
        });

        test("should throw when success is false", async () => {
            mockReconnectPost.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(reconnectSessionFn(1)).rejects.toThrow("Request failed");
        });
    });

    describe("deleteSessionFn", () => {
        test("should call delete endpoint", async () => {
            await deleteSessionFn(5);
            expect(mockDelete).toHaveBeenCalled();
        });

        test("should throw on error", async () => {
            mockDelete.mockResolvedValueOnce({
                data: null,
                error: { status: 404 },
            });
            await expect(deleteSessionFn(999)).rejects.toBeDefined();
        });

        test("should throw when success is false", async () => {
            mockDelete.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(deleteSessionFn(1)).rejects.toThrow("Request failed");
        });
    });
});
