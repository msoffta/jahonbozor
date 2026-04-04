import { Elysia } from "elysia";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { Permission } from "@jahonbozor/schemas";

import { createMockLogger } from "@backend/test/setup";

import { BroadcastsService } from "../broadcasts.service";

import type { BroadcastRecipientStatus, BroadcastStatus } from "@jahonbozor/schemas/src/broadcasts";

// --- Mock data ---

const mockBroadcastWithStats = {
    id: 1,
    name: "Test Broadcast",
    content: "<b>Hello</b>",
    media: null,
    buttons: null,
    templateId: null,
    sendVia: "SESSION" as const,
    sessionId: 1,
    status: "DRAFT",
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    createdById: 1,
    deletedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    template: null,
    session: { id: 1, name: "Test Session" },
    stats: { total: 10, sent: 8, failed: 1, pending: 1 },
};

const mockRecipient = {
    id: 1,
    broadcastId: 1,
    userId: 1,
    telegramId: "123456",
    status: "PENDING",
    errorMessage: null,
    sentAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    user: { id: 1, fullname: "Test User", username: "testuser" },
};

const mockUser = {
    id: 1,
    type: "staff" as const,
    fullname: "Test Admin",
    username: "testadmin",
    telegramId: "123456789",
    roleId: 1,
};

// --- Test app factory ---

const createTestApp = () => {
    const mockLogger = createMockLogger();

    return new Elysia()
        .derive(() => ({
            user: mockUser,
            permissions: [
                Permission.BROADCASTS_CREATE,
                Permission.BROADCASTS_READ,
                Permission.BROADCASTS_UPDATE,
                Permission.BROADCASTS_DELETE,
                Permission.BROADCASTS_LIST,
                Permission.BROADCASTS_SEND,
            ] as Permission[],
            logger: mockLogger,
            requestId: "test-request-id",
        }))
        .get("/broadcasts", async ({ query, logger }) => {
            return await BroadcastsService.getAllBroadcasts(
                {
                    page: Number(query.page) || 1,
                    limit: Number(query.limit) || 20,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: "",
                    status: query.status as BroadcastStatus | undefined,
                    sessionId: query.sessionId ? Number(query.sessionId) : undefined,
                },
                logger,
            );
        })
        .get("/broadcasts/:id", async ({ params, set, logger }) => {
            const result = await BroadcastsService.getBroadcast(Number(params.id), logger);
            if (!result.success) set.status = 404;
            return result;
        })
        .post("/broadcasts", async ({ body, user, set, logger, requestId }) => {
            const result = await BroadcastsService.createBroadcast(
                body as {
                    name: string;
                    sendVia: "BOT" | "SESSION";
                    recipientUserIds: number[];
                    sessionId?: number;
                    content?: string;
                    scheduledAt?: string;
                },
                { staffId: user.id, user, requestId },
                logger,
            );
            if (!result.success) set.status = 400;
            return result;
        })
        .patch("/broadcasts/:id", async ({ params, body, user, set, logger, requestId }) => {
            const result = await BroadcastsService.updateBroadcast(
                Number(params.id),
                body as { name?: string; content?: string },
                { staffId: user.id, user, requestId },
                logger,
            );
            if (!result.success) set.status = 400;
            return result;
        })
        .delete("/broadcasts/:id", async ({ params, user, set, logger, requestId }) => {
            const result = await BroadcastsService.deleteBroadcast(
                Number(params.id),
                { staffId: user.id, user, requestId },
                logger,
            );
            if (!result.success) set.status = 400;
            return result;
        })
        .get("/broadcasts/:id/recipients", async ({ params, query, set, logger }) => {
            const result = await BroadcastsService.getRecipients(
                Number(params.id),
                {
                    page: Number(query.page) || 1,
                    limit: Number(query.limit) || 20,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: "",
                    status: query.status as BroadcastRecipientStatus | undefined,
                },
                logger,
            );
            if (!result.success) set.status = 404;
            return result;
        })
        .post("/broadcasts/:id/send", async ({ params, user, set, logger, requestId }) => {
            const result = await BroadcastsService.sendBroadcast(
                Number(params.id),
                { staffId: user.id, user, requestId },
                logger,
            );
            if (!result.success) set.status = 400;
            return result;
        })
        .post("/broadcasts/:id/pause", async ({ params, user, set, logger, requestId }) => {
            const result = await BroadcastsService.pauseBroadcast(
                Number(params.id),
                { staffId: user.id, user, requestId },
                logger,
            );
            if (!result.success) set.status = 400;
            return result;
        })
        .post("/broadcasts/:id/resume", async ({ params, user, set, logger, requestId }) => {
            const result = await BroadcastsService.resumeBroadcast(
                Number(params.id),
                { staffId: user.id, user, requestId },
                logger,
            );
            if (!result.success) set.status = 400;
            return result;
        })
        .post("/broadcasts/:id/retry", async ({ params, user, set, logger, requestId }) => {
            const result = await BroadcastsService.retryBroadcast(
                Number(params.id),
                { staffId: user.id, user, requestId },
                logger,
            );
            if (!result.success) set.status = 400;
            return result;
        });
};

// --- Tests ---

describe("Broadcasts API Routes", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    // ─── GET /broadcasts ─────────────────────────────────────────────

    describe("GET /broadcasts", () => {
        test("should return paginated broadcasts list", async () => {
            // Arrange
            const spy = vi.spyOn(BroadcastsService, "getAllBroadcasts").mockResolvedValue({
                success: true,
                data: { count: 2, broadcasts: [mockBroadcastWithStats] },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcasts?page=1&limit=20"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(2);
            expect(body.data.broadcasts).toHaveLength(1);

            spy.mockRestore();
        });

        test("should return empty list when no broadcasts exist", async () => {
            // Arrange
            const spy = vi.spyOn(BroadcastsService, "getAllBroadcasts").mockResolvedValue({
                success: true,
                data: { count: 0, broadcasts: [] },
            });

            // Act
            const response = await app.handle(new Request("http://localhost/broadcasts"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(0);
            expect(body.data.broadcasts).toHaveLength(0);

            spy.mockRestore();
        });
    });

    // ─── GET /broadcasts/:id ─────────────────────────────────────────

    describe("GET /broadcasts/:id", () => {
        test("should return broadcast by id", async () => {
            // Arrange
            const spy = vi.spyOn(BroadcastsService, "getBroadcast").mockResolvedValue({
                success: true,
                data: mockBroadcastWithStats,
            });

            // Act
            const response = await app.handle(new Request("http://localhost/broadcasts/1"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.id).toBe(1);
            expect(body.data.stats.total).toBe(10);

            spy.mockRestore();
        });

        test("should return 404 when broadcast not found", async () => {
            // Arrange
            const spy = vi.spyOn(BroadcastsService, "getBroadcast").mockResolvedValue({
                success: false,
                error: "Broadcast not found",
            });

            // Act
            const response = await app.handle(new Request("http://localhost/broadcasts/999"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(404);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Broadcast not found");

            spy.mockRestore();
        });
    });

    // ─── POST /broadcasts ────────────────────────────────────────────

    describe("POST /broadcasts", () => {
        test("should create broadcast with valid data", async () => {
            // Arrange
            const spy = vi.spyOn(BroadcastsService, "createBroadcast").mockResolvedValue({
                success: true,
                data: mockBroadcastWithStats,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcasts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: "Test Broadcast",
                        content: "<b>Hello</b>",
                        sessionId: 1,
                        recipientUserIds: [1, 2, 3],
                    }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.id).toBe(1);

            spy.mockRestore();
        });

        test("should return 400 when no valid recipients", async () => {
            // Arrange
            const spy = vi.spyOn(BroadcastsService, "createBroadcast").mockResolvedValue({
                success: false,
                error: "No valid recipients with Telegram ID found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcasts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: "Empty Broadcast",
                        sessionId: 1,
                        recipientUserIds: [100],
                    }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.error).toBe("No valid recipients with Telegram ID found");

            spy.mockRestore();
        });
    });

    // ─── PATCH /broadcasts/:id ───────────────────────────────────────

    describe("PATCH /broadcasts/:id", () => {
        test("should update broadcast with valid data", async () => {
            // Arrange
            const updated = { ...mockBroadcastWithStats, name: "Updated Name" };
            const spy = vi.spyOn(BroadcastsService, "updateBroadcast").mockResolvedValue({
                success: true,
                data: updated,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcasts/1", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "Updated Name" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.name).toBe("Updated Name");

            spy.mockRestore();
        });

        test("should return 400 when broadcast not found", async () => {
            // Arrange
            const spy = vi.spyOn(BroadcastsService, "updateBroadcast").mockResolvedValue({
                success: false,
                error: "Broadcast not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcasts/999", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "New Name" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Broadcast not found");

            spy.mockRestore();
        });

        test("should return 400 when status is not DRAFT", async () => {
            // Arrange
            const spy = vi.spyOn(BroadcastsService, "updateBroadcast").mockResolvedValue({
                success: false,
                error: "Can only update broadcasts in DRAFT status",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcasts/1", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "New Name" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Can only update broadcasts in DRAFT status");

            spy.mockRestore();
        });
    });

    // ─── DELETE /broadcasts/:id ──────────────────────────────────────

    describe("DELETE /broadcasts/:id", () => {
        test("should delete broadcast successfully", async () => {
            // Arrange
            const deleted = { ...mockBroadcastWithStats, deletedAt: new Date() };
            const spy = vi.spyOn(BroadcastsService, "deleteBroadcast").mockResolvedValue({
                success: true,
                data: deleted,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcasts/1", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.id).toBe(1);

            spy.mockRestore();
        });

        test("should return 400 when broadcast not found", async () => {
            // Arrange
            const spy = vi.spyOn(BroadcastsService, "deleteBroadcast").mockResolvedValue({
                success: false,
                error: "Broadcast not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcasts/999", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Broadcast not found");

            spy.mockRestore();
        });
    });

    // ─── GET /broadcasts/:id/recipients ──────────────────────────────

    describe("GET /broadcasts/:id/recipients", () => {
        test("should return paginated recipients", async () => {
            // Arrange
            const spy = vi.spyOn(BroadcastsService, "getRecipients").mockResolvedValue({
                success: true,
                data: { count: 1, recipients: [mockRecipient] },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcasts/1/recipients?page=1&limit=20"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(1);
            expect(body.data.recipients).toHaveLength(1);

            spy.mockRestore();
        });

        test("should return 404 when broadcast not found", async () => {
            // Arrange
            const spy = vi.spyOn(BroadcastsService, "getRecipients").mockResolvedValue({
                success: false,
                error: "Broadcast not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcasts/999/recipients"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(404);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Broadcast not found");

            spy.mockRestore();
        });
    });

    // ─── POST /broadcasts/:id/send ───────────────────────────────────

    describe("POST /broadcasts/:id/send", () => {
        test("should send broadcast successfully", async () => {
            // Arrange
            const spy = vi.spyOn(BroadcastsService, "sendBroadcast").mockResolvedValue({
                success: true,
                data: { broadcastId: 1, status: "SENDING" },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcasts/1/send", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.broadcastId).toBe(1);
            expect(body.data.status).toBe("SENDING");

            spy.mockRestore();
        });

        test("should return 400 when status is not DRAFT or SCHEDULED", async () => {
            // Arrange
            const spy = vi.spyOn(BroadcastsService, "sendBroadcast").mockResolvedValue({
                success: false,
                error: "Can only send broadcasts in DRAFT or SCHEDULED status",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcasts/1/send", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Can only send broadcasts in DRAFT or SCHEDULED status");

            spy.mockRestore();
        });
    });

    // ─── POST /broadcasts/:id/pause ──────────────────────────────────

    describe("POST /broadcasts/:id/pause", () => {
        test("should pause broadcast successfully", async () => {
            // Arrange
            const spy = vi.spyOn(BroadcastsService, "pauseBroadcast").mockResolvedValue({
                success: true,
                data: { broadcastId: 1, status: "PAUSED" },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcasts/1/pause", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.broadcastId).toBe(1);
            expect(body.data.status).toBe("PAUSED");

            spy.mockRestore();
        });

        test("should return 400 when status is not SENDING", async () => {
            // Arrange
            const spy = vi.spyOn(BroadcastsService, "pauseBroadcast").mockResolvedValue({
                success: false,
                error: "Can only pause broadcasts that are currently sending",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcasts/1/pause", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Can only pause broadcasts that are currently sending");

            spy.mockRestore();
        });
    });

    // ─── POST /broadcasts/:id/resume ─────────────────────────────────

    describe("POST /broadcasts/:id/resume", () => {
        test("should resume broadcast successfully", async () => {
            // Arrange
            const spy = vi.spyOn(BroadcastsService, "resumeBroadcast").mockResolvedValue({
                success: true,
                data: { broadcastId: 1, status: "SENDING" },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcasts/1/resume", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.broadcastId).toBe(1);
            expect(body.data.status).toBe("SENDING");

            spy.mockRestore();
        });

        test("should return 400 when status is not PAUSED", async () => {
            // Arrange
            const spy = vi.spyOn(BroadcastsService, "resumeBroadcast").mockResolvedValue({
                success: false,
                error: "Can only resume broadcasts that are paused",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcasts/1/resume", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Can only resume broadcasts that are paused");

            spy.mockRestore();
        });
    });

    // ─── POST /broadcasts/:id/retry ──────────────────────────────────

    describe("POST /broadcasts/:id/retry", () => {
        test("should retry broadcast successfully", async () => {
            // Arrange
            const spy = vi.spyOn(BroadcastsService, "retryBroadcast").mockResolvedValue({
                success: true,
                data: { broadcastId: 1, status: "DRAFT" },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcasts/1/retry", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.broadcastId).toBe(1);
            expect(body.data.status).toBe("DRAFT");

            spy.mockRestore();
        });

        test("should return 400 when status is not COMPLETED or FAILED", async () => {
            // Arrange
            const spy = vi.spyOn(BroadcastsService, "retryBroadcast").mockResolvedValue({
                success: false,
                error: "Can only retry broadcasts that are completed or failed",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcasts/1/retry", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Can only retry broadcasts that are completed or failed");

            spy.mockRestore();
        });
    });
});

describe("Broadcasts API Integration", () => {
    test("getAllBroadcasts should be called with correct pagination", async () => {
        // Arrange
        const spy = vi.spyOn(BroadcastsService, "getAllBroadcasts").mockResolvedValue({
            success: true,
            data: { count: 0, broadcasts: [] },
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/broadcasts?page=3&limit=15"));

        // Assert
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ page: 3, limit: 15 }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("getBroadcast should be called with correct id", async () => {
        // Arrange
        const spy = vi.spyOn(BroadcastsService, "getBroadcast").mockResolvedValue({
            success: true,
            data: mockBroadcastWithStats,
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/broadcasts/42"));

        // Assert
        expect(spy).toHaveBeenCalledWith(42, expect.anything());

        spy.mockRestore();
    });

    test("createBroadcast should be called with context", async () => {
        // Arrange
        const spy = vi.spyOn(BroadcastsService, "createBroadcast").mockResolvedValue({
            success: true,
            data: mockBroadcastWithStats,
        });
        const app = createTestApp();

        // Act
        await app.handle(
            new Request("http://localhost/broadcasts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "Test",
                    sessionId: 1,
                    recipientUserIds: [1],
                }),
            }),
        );

        // Assert
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ name: "Test" }),
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("sendBroadcast should be called with correct id and context", async () => {
        // Arrange
        const spy = vi.spyOn(BroadcastsService, "sendBroadcast").mockResolvedValue({
            success: true,
            data: { broadcastId: 5, status: "SENDING" },
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/broadcasts/5/send", { method: "POST" }));

        // Assert
        expect(spy).toHaveBeenCalledWith(
            5,
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("deleteBroadcast should be called with correct id and context", async () => {
        // Arrange
        const spy = vi.spyOn(BroadcastsService, "deleteBroadcast").mockResolvedValue({
            success: true,
            data: mockBroadcastWithStats,
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/broadcasts/7", { method: "DELETE" }));

        // Assert
        expect(spy).toHaveBeenCalledWith(
            7,
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("getRecipients should be called with correct id", async () => {
        // Arrange
        const spy = vi.spyOn(BroadcastsService, "getRecipients").mockResolvedValue({
            success: true,
            data: { count: 0, recipients: [] },
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/broadcasts/3/recipients"));

        // Assert
        expect(spy).toHaveBeenCalledWith(
            3,
            expect.objectContaining({ page: 1, limit: 20 }),
            expect.anything(),
        );

        spy.mockRestore();
    });
});
