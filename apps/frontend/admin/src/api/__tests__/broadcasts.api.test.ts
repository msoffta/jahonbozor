import { beforeEach, describe, expect, test, vi } from "vitest";

import type { QueryFunctionContext } from "@tanstack/react-query";

interface MockEdenResponse {
    data: Record<string, unknown> | null;
    error: Record<string, unknown> | null;
}

const {
    mockGet,
    mockGetById,
    mockPost,
    mockDelete,
    mockRecipientsGet,
    mockSendPost,
    mockPausePost,
    mockResumePost,
    mockRetryPost,
} = vi.hoisted(() => ({
    mockGet: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { count: 0, broadcasts: [] } },
                error: null,
            }),
    ),
    mockGetById: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1, name: "Test Broadcast", status: "DRAFT" } },
                error: null,
            }),
    ),
    mockPost: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1, name: "New Broadcast" } },
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
    mockRecipientsGet: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { count: 0, recipients: [] } },
                error: null,
            }),
    ),
    mockSendPost: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1, status: "SENDING" } },
                error: null,
            }),
    ),
    mockPausePost: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1, status: "PAUSED" } },
                error: null,
            }),
    ),
    mockResumePost: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1, status: "SENDING" } },
                error: null,
            }),
    ),
    mockRetryPost: vi.fn(
        (): Promise<MockEdenResponse> =>
            Promise.resolve({
                data: { success: true, data: { id: 1, status: "SENDING" } },
                error: null,
            }),
    ),
}));

vi.mock("@/api/client", () => ({
    api: {
        api: {
            private: {
                broadcasts: Object.assign(
                    (_params: { id: number }) => ({
                        get: mockGetById,
                        delete: mockDelete,
                        recipients: { get: mockRecipientsGet },
                        send: { post: mockSendPost },
                        pause: { post: mockPausePost },
                        resume: { post: mockResumePost },
                        retry: { post: mockRetryPost },
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
    broadcastDetailQueryOptions,
    broadcastKeys,
    broadcastRecipientsQueryOptions,
    broadcastsListQueryOptions,
    createBroadcastFn,
    deleteBroadcastFn,
    pauseBroadcastFn,
    resumeBroadcastFn,
    retryBroadcastFn,
    sendBroadcastFn,
} from "../broadcasts.api";

type ListCtx = QueryFunctionContext<
    readonly ["broadcasts", "list", Record<string, unknown> | undefined]
>;
type DetailCtx = QueryFunctionContext<readonly ["broadcasts", "detail", number]>;
type RecipientsCtx = QueryFunctionContext<
    readonly ["broadcasts", "detail", number, "recipients", Record<string, unknown> | undefined]
>;

describe("broadcasts.api", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("broadcastKeys", () => {
        test("should have correct all key", () => {
            expect(broadcastKeys.all).toEqual(["broadcasts"]);
        });

        test("should have correct list key with params", () => {
            const params = { page: 2, limit: 10 };
            expect(broadcastKeys.list(params)).toEqual(["broadcasts", "list", params]);
        });

        test("should have correct list key without params", () => {
            expect(broadcastKeys.list()).toEqual(["broadcasts", "list", undefined]);
        });

        test("should have correct detail key", () => {
            expect(broadcastKeys.detail(5)).toEqual(["broadcasts", "detail", 5]);
        });

        test("should have correct recipients key", () => {
            expect(broadcastKeys.recipients(3)).toEqual(["broadcasts", "detail", 3, "recipients"]);
        });

        test("list key should extend all key", () => {
            expect(broadcastKeys.list()[0]).toBe(broadcastKeys.all[0]);
        });

        test("detail key should extend all key", () => {
            expect(broadcastKeys.detail(1)[0]).toBe(broadcastKeys.all[0]);
        });

        test("recipients key should extend detail key", () => {
            const recipientsKey = broadcastKeys.recipients(1);
            const detailKey = broadcastKeys.detail(1);
            expect(recipientsKey[0]).toBe(detailKey[0]);
            expect(recipientsKey[1]).toBe(detailKey[1]);
            expect(recipientsKey[2]).toBe(detailKey[2]);
        });
    });

    describe("broadcastsListQueryOptions", () => {
        test("should have correct queryKey", () => {
            const options = broadcastsListQueryOptions();
            expect([...options.queryKey]).toEqual(["broadcasts", "list", undefined]);
        });

        test("queryFn should call api with defaults", async () => {
            const options = broadcastsListQueryOptions();
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
            const options = broadcastsListQueryOptions({
                page: 3,
                limit: 50,
                searchQuery: "promo",
            });
            await options.queryFn!({} as ListCtx);
            expect(mockGet).toHaveBeenCalledWith({
                query: {
                    page: 3,
                    limit: 50,
                    searchQuery: "promo",
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
                        broadcasts: [{ id: 1 }, { id: 2 }],
                    },
                },
                error: null,
            });
            const result = await broadcastsListQueryOptions().queryFn!({} as ListCtx);
            expect(result).toMatchObject({ count: 2 });
        });

        test("queryFn should throw on error", async () => {
            mockGet.mockResolvedValueOnce({
                data: null,
                error: { status: 500 },
            });
            await expect(
                broadcastsListQueryOptions().queryFn!({} as ListCtx),
            ).rejects.toBeDefined();
        });

        test("queryFn should throw when success is false", async () => {
            mockGet.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(broadcastsListQueryOptions().queryFn!({} as ListCtx)).rejects.toThrow(
                "Request failed",
            );
        });
    });

    describe("broadcastDetailQueryOptions", () => {
        test("should be enabled when id > 0", () => {
            expect(broadcastDetailQueryOptions(1).enabled).toBe(true);
        });

        test("should be disabled when id is 0", () => {
            expect(broadcastDetailQueryOptions(0).enabled).toBe(false);
        });

        test("should be disabled when id is negative", () => {
            expect(broadcastDetailQueryOptions(-1).enabled).toBe(false);
        });

        test("queryFn should return broadcast on success", async () => {
            mockGetById.mockResolvedValueOnce({
                data: { success: true, data: { id: 3, name: "Broadcast 3", status: "DRAFT" } },
                error: null,
            });
            const result = await broadcastDetailQueryOptions(3).queryFn!({} as DetailCtx);
            expect(result).toMatchObject({ id: 3, name: "Broadcast 3" });
        });

        test("queryFn should throw on error", async () => {
            mockGetById.mockResolvedValueOnce({
                data: null,
                error: { status: 404 },
            });
            await expect(
                broadcastDetailQueryOptions(1).queryFn!({} as DetailCtx),
            ).rejects.toBeDefined();
        });

        test("queryFn should throw when success is false", async () => {
            mockGetById.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(broadcastDetailQueryOptions(1).queryFn!({} as DetailCtx)).rejects.toThrow(
                "Request failed",
            );
        });

        test("refetchInterval should return 3000 when status is SENDING", () => {
            const options = broadcastDetailQueryOptions(1);
            const refetchInterval = options.refetchInterval as (query: {
                state: { data?: { status: string } };
            }) => number | false;
            const result = refetchInterval({
                state: { data: { status: "SENDING" } },
            });
            expect(result).toBe(3000);
        });

        test("refetchInterval should return 3000 when status is PAUSED", () => {
            const options = broadcastDetailQueryOptions(1);
            const refetchInterval = options.refetchInterval as (query: {
                state: { data?: { status: string } };
            }) => number | false;
            const result = refetchInterval({
                state: { data: { status: "PAUSED" } },
            });
            expect(result).toBe(3000);
        });

        test("refetchInterval should return 5000 when status is DRAFT", () => {
            const options = broadcastDetailQueryOptions(1);
            const refetchInterval = options.refetchInterval as (query: {
                state: { data?: { status: string } };
            }) => number | false;
            const result = refetchInterval({
                state: { data: { status: "DRAFT" } },
            });
            expect(result).toBe(5000);
        });

        test("refetchInterval should return false when status is COMPLETED", () => {
            const options = broadcastDetailQueryOptions(1);
            const refetchInterval = options.refetchInterval as (query: {
                state: { data?: { status: string } };
            }) => number | false;
            const result = refetchInterval({
                state: { data: { status: "COMPLETED" } },
            });
            expect(result).toBe(false);
        });

        test("refetchInterval should return false when data is undefined", () => {
            const options = broadcastDetailQueryOptions(1);
            const refetchInterval = options.refetchInterval as (query: {
                state: { data?: { status: string } };
            }) => number | false;
            const result = refetchInterval({
                state: { data: undefined },
            });
            expect(result).toBe(false);
        });
    });

    describe("broadcastRecipientsQueryOptions", () => {
        test("should have correct queryKey", () => {
            const options = broadcastRecipientsQueryOptions(1);
            expect([...options.queryKey]).toEqual([
                "broadcasts",
                "detail",
                1,
                "recipients",
                undefined,
            ]);
        });

        test("should have correct queryKey with params", () => {
            const options = broadcastRecipientsQueryOptions(1, { page: 2, limit: 10 });
            expect([...options.queryKey]).toEqual([
                "broadcasts",
                "detail",
                1,
                "recipients",
                { page: 2, limit: 10 },
            ]);
        });

        test("should be enabled when id > 0", () => {
            expect(broadcastRecipientsQueryOptions(1).enabled).toBe(true);
        });

        test("should be disabled when id is 0", () => {
            expect(broadcastRecipientsQueryOptions(0).enabled).toBe(false);
        });

        test("should be disabled when id is negative", () => {
            expect(broadcastRecipientsQueryOptions(-1).enabled).toBe(false);
        });

        test("queryFn should call api with defaults", async () => {
            await broadcastRecipientsQueryOptions(1).queryFn!({} as RecipientsCtx);
            expect(mockRecipientsGet).toHaveBeenCalledWith({
                query: {
                    page: 1,
                    limit: 20,
                    searchQuery: "",
                    sortBy: "id",
                    sortOrder: "asc",
                },
            });
        });

        test("queryFn should merge custom params", async () => {
            await broadcastRecipientsQueryOptions(1, { page: 3, limit: 50 }).queryFn!(
                {} as RecipientsCtx,
            );
            expect(mockRecipientsGet).toHaveBeenCalledWith({
                query: {
                    page: 3,
                    limit: 50,
                    searchQuery: "",
                    sortBy: "id",
                    sortOrder: "asc",
                },
            });
        });

        test("queryFn should return data on success", async () => {
            mockRecipientsGet.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        count: 3,
                        recipients: [{ id: 1 }, { id: 2 }, { id: 3 }],
                    },
                },
                error: null,
            });
            const result = await broadcastRecipientsQueryOptions(1).queryFn!({} as RecipientsCtx);
            expect(result).toMatchObject({ count: 3 });
        });

        test("queryFn should throw on error", async () => {
            mockRecipientsGet.mockResolvedValueOnce({
                data: null,
                error: { status: 500 },
            });
            await expect(
                broadcastRecipientsQueryOptions(1).queryFn!({} as RecipientsCtx),
            ).rejects.toBeDefined();
        });

        test("queryFn should throw when success is false", async () => {
            mockRecipientsGet.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(
                broadcastRecipientsQueryOptions(1).queryFn!({} as RecipientsCtx),
            ).rejects.toThrow("Request failed");
        });
    });

    describe("createBroadcastFn", () => {
        test("should call api with body", async () => {
            const body = {
                name: "Promo",
                sendVia: "SESSION" as const,
                content: "Hello!",
                sessionId: 1,
                recipientUserIds: [1, 2, 3],
            };
            await createBroadcastFn(body);
            expect(mockPost).toHaveBeenCalledWith(body);
        });

        test("should call api with full body including optional fields", async () => {
            const body = {
                name: "Full Broadcast",
                sendVia: "SESSION" as const,
                content: "Content",
                media: [{ type: "photo" as const, url: "https://img.test/1.jpg" }],
                buttons: [{ text: "Click", url: "https://example.com" }],
                templateId: 5,
                sessionId: 2,
                recipientUserIds: [10, 20],
                scheduledAt: "2026-04-10T10:00:00Z",
            };
            await createBroadcastFn(body);
            expect(mockPost).toHaveBeenCalledWith(body);
        });

        test("should return created broadcast on success", async () => {
            const result = await createBroadcastFn({
                name: "B",
                sendVia: "BOT",
                recipientUserIds: [1],
            });
            expect(result).toMatchObject({ id: 1, name: "New Broadcast" });
        });

        test("should throw on error", async () => {
            mockPost.mockResolvedValueOnce({
                data: null,
                error: { status: 400 },
            });
            await expect(
                createBroadcastFn({ name: "", sendVia: "BOT", recipientUserIds: [] }),
            ).rejects.toBeDefined();
        });

        test("should throw when success is false", async () => {
            mockPost.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(
                createBroadcastFn({ name: "", sendVia: "BOT", recipientUserIds: [] }),
            ).rejects.toThrow("Request failed");
        });
    });

    describe("sendBroadcastFn", () => {
        test("should call send endpoint", async () => {
            await sendBroadcastFn(5);
            expect(mockSendPost).toHaveBeenCalled();
        });

        test("should throw on error", async () => {
            mockSendPost.mockResolvedValueOnce({
                data: null,
                error: { status: 500 },
            });
            await expect(sendBroadcastFn(1)).rejects.toBeDefined();
        });

        test("should throw when success is false", async () => {
            mockSendPost.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(sendBroadcastFn(1)).rejects.toThrow("Request failed");
        });
    });

    describe("pauseBroadcastFn", () => {
        test("should call pause endpoint", async () => {
            await pauseBroadcastFn(5);
            expect(mockPausePost).toHaveBeenCalled();
        });

        test("should throw on error", async () => {
            mockPausePost.mockResolvedValueOnce({
                data: null,
                error: { status: 500 },
            });
            await expect(pauseBroadcastFn(1)).rejects.toBeDefined();
        });

        test("should throw when success is false", async () => {
            mockPausePost.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(pauseBroadcastFn(1)).rejects.toThrow("Request failed");
        });
    });

    describe("resumeBroadcastFn", () => {
        test("should call resume endpoint", async () => {
            await resumeBroadcastFn(5);
            expect(mockResumePost).toHaveBeenCalled();
        });

        test("should throw on error", async () => {
            mockResumePost.mockResolvedValueOnce({
                data: null,
                error: { status: 500 },
            });
            await expect(resumeBroadcastFn(1)).rejects.toBeDefined();
        });

        test("should throw when success is false", async () => {
            mockResumePost.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(resumeBroadcastFn(1)).rejects.toThrow("Request failed");
        });
    });

    describe("retryBroadcastFn", () => {
        test("should call retry endpoint", async () => {
            await retryBroadcastFn(5);
            expect(mockRetryPost).toHaveBeenCalled();
        });

        test("should throw on error", async () => {
            mockRetryPost.mockResolvedValueOnce({
                data: null,
                error: { status: 500 },
            });
            await expect(retryBroadcastFn(1)).rejects.toBeDefined();
        });

        test("should throw when success is false", async () => {
            mockRetryPost.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(retryBroadcastFn(1)).rejects.toThrow("Request failed");
        });
    });

    describe("deleteBroadcastFn", () => {
        test("should call delete endpoint", async () => {
            await deleteBroadcastFn(5);
            expect(mockDelete).toHaveBeenCalled();
        });

        test("should throw on error", async () => {
            mockDelete.mockResolvedValueOnce({
                data: null,
                error: { status: 404 },
            });
            await expect(deleteBroadcastFn(999)).rejects.toBeDefined();
        });

        test("should throw when success is false", async () => {
            mockDelete.mockResolvedValueOnce({
                data: { success: false },
                error: null,
            });
            await expect(deleteBroadcastFn(1)).rejects.toThrow("Request failed");
        });
    });
});
