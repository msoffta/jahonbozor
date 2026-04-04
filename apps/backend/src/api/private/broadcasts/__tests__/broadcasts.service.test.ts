import { beforeEach, describe, expect, test, vi } from "vitest";

import { createMockLogger, expectFailure, expectSuccess, prismaMock } from "@backend/test/setup";

import { BroadcastsService } from "../broadcasts.service";

// Mock broadcast-worker module
const mockExecuteBroadcast = vi.fn();
const mockPauseBroadcastWorker = vi.fn();
const mockResumeBroadcastWorker = vi.fn();

vi.mock("@backend/lib/broadcast-worker", () => ({
    executeBroadcast: (...args: unknown[]) => mockExecuteBroadcast(...args),
    pauseBroadcast: (...args: unknown[]) => mockPauseBroadcastWorker(...args),
    resumeBroadcast: (...args: unknown[]) => mockResumeBroadcastWorker(...args),
}));

// --- Mock data factories ---

const mockUser = {
    id: 1,
    type: "staff" as const,
    fullname: "Admin",
    username: "admin",
    telegramId: "123",
    roleId: 1,
};

const createMockContext = () => ({
    staffId: 1,
    user: mockUser,
    requestId: "test-req-id",
});

const createMockBroadcast = (overrides = {}) => ({
    id: 1,
    name: "Test Broadcast",
    content: "<b>Hello</b>",
    media: null,
    buttons: null,
    templateId: null,
    sendVia: "SESSION" as const,
    sessionId: 1,
    status: "DRAFT" as const,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    createdById: 1,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    template: null,
    session: { id: 1, name: "Test Session" },
    ...overrides,
});

const createMockRecipient = (overrides = {}) => ({
    id: 1,
    broadcastId: 1,
    userId: 1,
    telegramId: "123456",
    status: "PENDING" as const,
    errorMessage: null,
    sentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id: 1, fullname: "Test User", username: "testuser" },
    ...overrides,
});

/** Sets up broadcastRecipient.count to return stats in order: total, sent, failed, pending */
const setupStatsCountMock = (total: number, sent: number, failed: number, pending: number) => {
    prismaMock.broadcastRecipient.count
        .mockResolvedValueOnce(total)
        .mockResolvedValueOnce(sent)
        .mockResolvedValueOnce(failed)
        .mockResolvedValueOnce(pending);
};

describe("BroadcastsService", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeEach(() => {
        mockLogger = createMockLogger();
        mockExecuteBroadcast.mockReset();
        mockPauseBroadcastWorker.mockReset();
        mockResumeBroadcastWorker.mockReset();
    });

    // ─── getAllBroadcasts ─────────────────────────────────────────────

    describe("getAllBroadcasts", () => {
        test("should return paginated broadcasts with stats", async () => {
            // Arrange
            const broadcasts = [createMockBroadcast({ id: 1 }), createMockBroadcast({ id: 2 })];
            prismaMock.$transaction.mockResolvedValueOnce([2, broadcasts]);
            // Stats for broadcast 1
            setupStatsCountMock(10, 8, 1, 1);
            // Stats for broadcast 2
            setupStatsCountMock(5, 5, 0, 0);

            // Act
            const result = await BroadcastsService.getAllBroadcasts(
                {
                    page: 1,
                    limit: 20,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: "",
                },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; broadcasts: unknown[] };
            expect(data.count).toBe(2);
            expect(data.broadcasts).toHaveLength(2);
        });

        test("should return empty list when no broadcasts exist", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([0, []]);

            // Act
            const result = await BroadcastsService.getAllBroadcasts(
                {
                    page: 1,
                    limit: 20,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: "",
                },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; broadcasts: unknown[] };
            expect(data.count).toBe(0);
            expect(data.broadcasts).toHaveLength(0);
        });

        test("should filter by status", async () => {
            // Arrange
            const broadcasts = [createMockBroadcast({ id: 1, status: "SENDING" })];
            prismaMock.$transaction.mockResolvedValueOnce([1, broadcasts]);
            setupStatsCountMock(10, 5, 0, 5);

            // Act
            const result = await BroadcastsService.getAllBroadcasts(
                {
                    page: 1,
                    limit: 20,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: "",
                    status: "SENDING",
                },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; broadcasts: unknown[] };
            expect(data.count).toBe(1);
            expect(data.broadcasts).toHaveLength(1);
        });

        test("should filter by sessionId", async () => {
            // Arrange
            const broadcasts = [createMockBroadcast({ id: 1, sessionId: 42 })];
            prismaMock.$transaction.mockResolvedValueOnce([1, broadcasts]);
            setupStatsCountMock(3, 3, 0, 0);

            // Act
            const result = await BroadcastsService.getAllBroadcasts(
                {
                    page: 1,
                    limit: 20,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: "",
                    sessionId: 42,
                },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; broadcasts: unknown[] };
            expect(data.count).toBe(1);
            expect(data.broadcasts).toHaveLength(1);
        });
    });

    // ─── getBroadcast ────────────────────────────────────────────────

    describe("getBroadcast", () => {
        test("should return broadcast with stats", async () => {
            // Arrange
            const broadcast = createMockBroadcast();
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(broadcast as never);
            setupStatsCountMock(10, 8, 1, 1);

            // Act
            const result = await BroadcastsService.getBroadcast(1, mockLogger);

            // Assert
            const success = expectSuccess(result);
            const data = success.data as Record<string, unknown>;
            expect(data.id).toBe(1);
            expect(data.stats).toEqual({ total: 10, sent: 8, failed: 1, pending: 1 });
        });

        test("should return error when broadcast not found", async () => {
            // Arrange
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await BroadcastsService.getBroadcast(999, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Broadcast not found");
        });
    });

    // ─── createBroadcast ─────────────────────────────────────────────

    describe("createBroadcast", () => {
        test("should create broadcast with recipients who have telegramId", async () => {
            // Arrange
            const users = [
                { id: 1, telegramId: "111" },
                { id: 2, telegramId: "222" },
            ];
            prismaMock.users.findMany.mockResolvedValueOnce(users as never);

            const newBroadcast = createMockBroadcast({ id: 10 });
            prismaMock.broadcast.create.mockResolvedValueOnce(newBroadcast as never);
            prismaMock.broadcastRecipient.createMany.mockResolvedValueOnce({ count: 2 });
            prismaMock.auditLog.create.mockResolvedValueOnce({} as never);
            setupStatsCountMock(2, 0, 0, 2);

            // Act
            const result = await BroadcastsService.createBroadcast(
                {
                    name: "Test Broadcast",
                    content: "<b>Hello</b>",
                    sendVia: "SESSION",
                    sessionId: 1,
                    recipientUserIds: [1, 2],
                },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as Record<string, unknown>;
            expect(data.id).toBe(10);
            expect(prismaMock.broadcast.create).toHaveBeenCalled();
            expect(prismaMock.broadcastRecipient.createMany).toHaveBeenCalled();
        });

        test("should set SCHEDULED status when scheduledAt is provided", async () => {
            // Arrange
            const users = [{ id: 1, telegramId: "111" }];
            prismaMock.users.findMany.mockResolvedValueOnce(users as never);

            const scheduledDate = "2026-05-01T12:00:00.000Z";
            const newBroadcast = createMockBroadcast({
                id: 11,
                status: "SCHEDULED",
                scheduledAt: new Date(scheduledDate),
            });
            prismaMock.broadcast.create.mockResolvedValueOnce(newBroadcast as never);
            prismaMock.broadcastRecipient.createMany.mockResolvedValueOnce({ count: 1 });
            prismaMock.auditLog.create.mockResolvedValueOnce({} as never);
            setupStatsCountMock(1, 0, 0, 1);

            // Act
            const result = await BroadcastsService.createBroadcast(
                {
                    name: "Scheduled Broadcast",
                    sendVia: "SESSION",
                    sessionId: 1,
                    recipientUserIds: [1],
                    scheduledAt: scheduledDate,
                },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as Record<string, unknown>;
            expect(data.status).toBe("SCHEDULED");
            expect(prismaMock.broadcast.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ status: "SCHEDULED" }),
                }),
            );
        });

        test("should return error when no valid recipients found (SESSION mode)", async () => {
            // Arrange
            prismaMock.users.findMany.mockResolvedValueOnce([]);

            // Act
            const result = await BroadcastsService.createBroadcast(
                {
                    name: "Empty Broadcast",
                    sendVia: "SESSION",
                    sessionId: 1,
                    recipientUserIds: [100, 200],
                },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("No valid recipients found");
        });

        test("should return error when no valid recipients with telegramId (BOT mode)", async () => {
            // Arrange
            prismaMock.users.findMany.mockResolvedValueOnce([]);

            // Act
            const result = await BroadcastsService.createBroadcast(
                {
                    name: "Empty Broadcast",
                    sendVia: "BOT",
                    recipientUserIds: [100, 200],
                },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("No valid recipients with Telegram ID found");
        });

        test("should skip users without telegramId", async () => {
            // Arrange — only user 1 has telegramId; user 2 is filtered out by query
            const users = [{ id: 1, telegramId: "111" }];
            prismaMock.users.findMany.mockResolvedValueOnce(users as never);

            const newBroadcast = createMockBroadcast({ id: 12 });
            prismaMock.broadcast.create.mockResolvedValueOnce(newBroadcast as never);
            prismaMock.broadcastRecipient.createMany.mockResolvedValueOnce({ count: 1 });
            prismaMock.auditLog.create.mockResolvedValueOnce({} as never);
            setupStatsCountMock(1, 0, 0, 1);

            // Act
            const result = await BroadcastsService.createBroadcast(
                {
                    name: "Partial Recipients",
                    sendVia: "SESSION",
                    sessionId: 1,
                    recipientUserIds: [1, 2],
                },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toBeDefined();
            // Only 1 recipient should be created (user 2 lacks telegramId)
            expect(prismaMock.broadcastRecipient.createMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.arrayContaining([
                        expect.objectContaining({ userId: 1, telegramId: "111" }),
                    ]),
                }),
            );
        });

        test("should create audit log", async () => {
            // Arrange
            const users = [{ id: 1, telegramId: "111" }];
            prismaMock.users.findMany.mockResolvedValueOnce(users as never);

            const newBroadcast = createMockBroadcast({ id: 13 });
            prismaMock.broadcast.create.mockResolvedValueOnce(newBroadcast as never);
            prismaMock.broadcastRecipient.createMany.mockResolvedValueOnce({ count: 1 });
            prismaMock.auditLog.create.mockResolvedValueOnce({} as never);
            setupStatsCountMock(1, 0, 0, 1);

            // Act
            await BroadcastsService.createBroadcast(
                {
                    name: "Audit Test",
                    sendVia: "SESSION",
                    sessionId: 1,
                    recipientUserIds: [1],
                },
                createMockContext(),
                mockLogger,
            );

            // Assert
            expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        entityType: "broadcast",
                        action: "CREATE",
                    }),
                }),
            );
        });
    });

    // ─── updateBroadcast ─────────────────────────────────────────────

    describe("updateBroadcast", () => {
        test("should update DRAFT broadcast", async () => {
            // Arrange
            const existing = createMockBroadcast({ id: 1, status: "DRAFT" });
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(existing as never);

            const updated = createMockBroadcast({ id: 1, name: "Updated Name" });
            prismaMock.broadcast.update.mockResolvedValueOnce(updated as never);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as never);
            setupStatsCountMock(5, 0, 0, 5);

            // Act
            const result = await BroadcastsService.updateBroadcast(
                1,
                { name: "Updated Name" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as Record<string, unknown>;
            expect(data.name).toBe("Updated Name");
        });

        test("should return error when broadcast not found", async () => {
            // Arrange
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await BroadcastsService.updateBroadcast(
                999,
                { name: "New Name" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Broadcast not found");
        });

        test("should return error when status is not DRAFT", async () => {
            // Arrange
            const existing = createMockBroadcast({ id: 1, status: "SENDING" });
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(existing as never);

            // Act
            const result = await BroadcastsService.updateBroadcast(
                1,
                { name: "New Name" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Can only update broadcasts in DRAFT status");
        });
    });

    // ─── deleteBroadcast ─────────────────────────────────────────────

    describe("deleteBroadcast", () => {
        test("should soft-delete broadcast", async () => {
            // Arrange
            const existing = createMockBroadcast({ id: 1 });
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(existing as never);

            const deleted = createMockBroadcast({ id: 1, deletedAt: new Date() });
            prismaMock.broadcast.update.mockResolvedValueOnce(deleted as never);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as never);

            // Act
            const result = await BroadcastsService.deleteBroadcast(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as Record<string, unknown>;
            expect(data.id).toBe(1);
            expect(data.deletedAt).toBeDefined();
        });

        test("should return error when broadcast not found", async () => {
            // Arrange
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await BroadcastsService.deleteBroadcast(
                999,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Broadcast not found");
        });
    });

    // ─── getRecipients ───────────────────────────────────────────────

    describe("getRecipients", () => {
        test("should return paginated recipients with user info", async () => {
            // Arrange
            const broadcast = { id: 1 };
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(broadcast as never);

            const recipients = [
                createMockRecipient({ id: 1, userId: 1 }),
                createMockRecipient({ id: 2, userId: 2, telegramId: "789" }),
            ];
            prismaMock.$transaction.mockResolvedValueOnce([2, recipients]);

            // Act
            const result = await BroadcastsService.getRecipients(
                1,
                {
                    page: 1,
                    limit: 20,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: "",
                },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; recipients: unknown[] };
            expect(data.count).toBe(2);
            expect(data.recipients).toHaveLength(2);
        });

        test("should return error when broadcast not found", async () => {
            // Arrange
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await BroadcastsService.getRecipients(
                999,
                {
                    page: 1,
                    limit: 20,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: "",
                },
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Broadcast not found");
        });

        test("should filter recipients by status", async () => {
            // Arrange
            const broadcast = { id: 1 };
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(broadcast as never);

            const recipients = [createMockRecipient({ id: 1, status: "SENT" })];
            prismaMock.$transaction.mockResolvedValueOnce([1, recipients]);

            // Act
            const result = await BroadcastsService.getRecipients(
                1,
                {
                    page: 1,
                    limit: 20,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: "",
                    status: "SENT",
                },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; recipients: unknown[] };
            expect(data.count).toBe(1);
            expect(data.recipients).toHaveLength(1);
        });
    });

    // ─── sendBroadcast ───────────────────────────────────────────────

    describe("sendBroadcast", () => {
        test("should start immediately when no scheduledAt", async () => {
            // Arrange
            const broadcast = createMockBroadcast({ id: 1, status: "DRAFT", scheduledAt: null });
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(broadcast as never);

            // Act
            const result = await BroadcastsService.sendBroadcast(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { broadcastId: number; status: string };
            expect(data.broadcastId).toBe(1);
            expect(data.status).toBe("SENDING");
            expect(mockExecuteBroadcast).toHaveBeenCalledWith(1, mockLogger);
        });

        test("should set SCHEDULED when scheduledAt exists", async () => {
            // Arrange
            const broadcast = createMockBroadcast({
                id: 1,
                status: "DRAFT",
                scheduledAt: new Date("2026-05-01T12:00:00Z"),
            });
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(broadcast as never);
            prismaMock.broadcast.update.mockResolvedValueOnce({} as never);

            // Act
            const result = await BroadcastsService.sendBroadcast(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { broadcastId: number; status: string };
            expect(data.broadcastId).toBe(1);
            expect(data.status).toBe("SCHEDULED");
            expect(prismaMock.broadcast.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ status: "SCHEDULED" }),
                }),
            );
            expect(mockExecuteBroadcast).not.toHaveBeenCalled();
        });

        test("should return error when broadcast not found", async () => {
            // Arrange
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await BroadcastsService.sendBroadcast(
                999,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Broadcast not found");
        });

        test("should return error when status is not DRAFT or SCHEDULED", async () => {
            // Arrange
            const broadcast = createMockBroadcast({ id: 1, status: "SENDING" });
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(broadcast as never);

            // Act
            const result = await BroadcastsService.sendBroadcast(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Can only send broadcasts in DRAFT or SCHEDULED status");
        });

        test("should return error when status is COMPLETED", async () => {
            // Arrange
            const broadcast = createMockBroadcast({ id: 1, status: "COMPLETED" });
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(broadcast as never);

            // Act
            const result = await BroadcastsService.sendBroadcast(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Can only send broadcasts in DRAFT or SCHEDULED status");
        });
    });

    // ─── pauseBroadcast ──────────────────────────────────────────────

    describe("pauseBroadcast", () => {
        test("should pause SENDING broadcast", async () => {
            // Arrange
            const broadcast = createMockBroadcast({ id: 1, status: "SENDING" });
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(broadcast as never);
            mockPauseBroadcastWorker.mockReturnValueOnce(true);

            // Act
            const result = await BroadcastsService.pauseBroadcast(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { broadcastId: number; status: string };
            expect(data.broadcastId).toBe(1);
            expect(data.status).toBe("PAUSED");
            expect(mockPauseBroadcastWorker).toHaveBeenCalledWith(1);
        });

        test("should return error when broadcast not found", async () => {
            // Arrange
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await BroadcastsService.pauseBroadcast(
                999,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Broadcast not found");
        });

        test("should return error when status is not SENDING", async () => {
            // Arrange
            const broadcast = createMockBroadcast({ id: 1, status: "DRAFT" });
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(broadcast as never);

            // Act
            const result = await BroadcastsService.pauseBroadcast(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Can only pause broadcasts that are currently sending");
        });

        test("should return error when broadcast is not actively running", async () => {
            // Arrange
            const broadcast = createMockBroadcast({ id: 1, status: "SENDING" });
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(broadcast as never);
            mockPauseBroadcastWorker.mockReturnValueOnce(false);

            // Act
            const result = await BroadcastsService.pauseBroadcast(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Broadcast is not actively running");
        });
    });

    // ─── resumeBroadcast ─────────────────────────────────────────────

    describe("resumeBroadcast", () => {
        test("should resume PAUSED broadcast", async () => {
            // Arrange
            const broadcast = createMockBroadcast({ id: 1, status: "PAUSED" });
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(broadcast as never);

            // Act
            const result = await BroadcastsService.resumeBroadcast(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { broadcastId: number; status: string };
            expect(data.broadcastId).toBe(1);
            expect(data.status).toBe("SENDING");
            expect(mockResumeBroadcastWorker).toHaveBeenCalledWith(1, mockLogger);
        });

        test("should return error when broadcast not found", async () => {
            // Arrange
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await BroadcastsService.resumeBroadcast(
                999,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Broadcast not found");
        });

        test("should return error when status is not PAUSED", async () => {
            // Arrange
            const broadcast = createMockBroadcast({ id: 1, status: "DRAFT" });
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(broadcast as never);

            // Act
            const result = await BroadcastsService.resumeBroadcast(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Can only resume broadcasts that are paused");
        });
    });

    // ─── retryBroadcast ──────────────────────────────────────────────

    describe("retryBroadcast", () => {
        test("should reset failed recipients and set status to DRAFT", async () => {
            // Arrange
            const broadcast = createMockBroadcast({ id: 1, status: "COMPLETED" });
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(broadcast as never);
            prismaMock.broadcastRecipient.updateMany.mockResolvedValueOnce({ count: 3 });
            prismaMock.broadcast.update.mockResolvedValueOnce({} as never);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as never);

            // Act
            const result = await BroadcastsService.retryBroadcast(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { broadcastId: number; status: string };
            expect(data.broadcastId).toBe(1);
            expect(data.status).toBe("DRAFT");
            expect(prismaMock.broadcastRecipient.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { broadcastId: 1, status: "FAILED" },
                    data: expect.objectContaining({ status: "PENDING" }),
                }),
            );
        });

        test("should retry FAILED broadcast", async () => {
            // Arrange
            const broadcast = createMockBroadcast({ id: 1, status: "FAILED" });
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(broadcast as never);
            prismaMock.broadcastRecipient.updateMany.mockResolvedValueOnce({ count: 5 });
            prismaMock.broadcast.update.mockResolvedValueOnce({} as never);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as never);

            // Act
            const result = await BroadcastsService.retryBroadcast(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { broadcastId: number; status: string };
            expect(data.status).toBe("DRAFT");
        });

        test("should return error when broadcast not found", async () => {
            // Arrange
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await BroadcastsService.retryBroadcast(
                999,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Broadcast not found");
        });

        test("should return error when status is not COMPLETED or FAILED", async () => {
            // Arrange
            const broadcast = createMockBroadcast({ id: 1, status: "SENDING" });
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(broadcast as never);

            // Act
            const result = await BroadcastsService.retryBroadcast(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Can only retry broadcasts that are completed or failed");
        });

        test("should return error when status is DRAFT", async () => {
            // Arrange
            const broadcast = createMockBroadcast({ id: 1, status: "DRAFT" });
            prismaMock.broadcast.findFirst.mockResolvedValueOnce(broadcast as never);

            // Act
            const result = await BroadcastsService.retryBroadcast(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Can only retry broadcasts that are completed or failed");
        });
    });
});
