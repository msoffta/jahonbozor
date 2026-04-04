import { Elysia } from "elysia";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { Permission } from "@jahonbozor/schemas";

import { createMockLogger, prismaMock } from "@backend/test/setup";

import { TelegramSessionsService } from "../telegram-sessions.service";

// --- Mock mtproto module ---
vi.mock("@backend/lib/mtproto", () => ({
    initQrLogin: vi.fn(),
    pollQrStatus: vi.fn(),
    disconnectClient: vi.fn(),
    connectClient: vi.fn(),
}));

vi.mock("@backend/lib/audit", () => ({
    auditInTransaction: vi.fn(() => Promise.resolve()),
}));

vi.mock("@backend/lib/snapshots", () => ({
    createTelegramSessionSnapshot: vi.fn((s: unknown) => s),
}));

// --- Mock data ---

const mockUser = {
    id: 1,
    type: "staff" as const,
    fullname: "Test Admin",
    username: "testadmin",
    telegramId: "123456789",
    roleId: 1,
};

const allPermissions = [
    Permission.TELEGRAM_SESSIONS_LIST,
    Permission.TELEGRAM_SESSIONS_READ,
    Permission.TELEGRAM_SESSIONS_CREATE,
    Permission.TELEGRAM_SESSIONS_UPDATE,
    Permission.TELEGRAM_SESSIONS_DELETE,
];

const mockSession = {
    id: 1,
    name: "Test Session",
    phone: "+998901234567",
    apiId: 12345,
    apiHash: "abc123",
    sessionString: "encrypted",
    status: "ACTIVE" as const,
    lastUsedAt: new Date("2024-06-01"),
    deletedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

/**
 * Creates a test Elysia app that mirrors the telegram-sessions router structure.
 * Uses mocked middleware context instead of real authMiddleware.
 *
 * Note: This duplicates routing logic from telegram-sessions.index.ts intentionally -
 * Elysia macros (authMiddleware) cannot be easily mocked via vi.fn()
 * because they use runtime plugins. Using spyOn(TelegramSessionsService) allows
 * testing route-to-service integration without full middleware stack.
 */
const createTestApp = () => {
    const mockLogger = createMockLogger();

    return new Elysia()
        .derive(() => ({
            user: mockUser,
            permissions: allPermissions,
            logger: mockLogger,
            requestId: "test-request-id",
        }))
        .get("/telegram-sessions", async ({ query, logger }) => {
            return await TelegramSessionsService.getAllSessions(
                {
                    page: Number(query.page) || 1,
                    limit: Number(query.limit) || 20,
                    sortBy: query.sortBy || "id",
                    sortOrder: (query.sortOrder as "asc" | "desc") || ("asc" as const),
                    searchQuery: query.searchQuery || "",
                    status: query.status as "ACTIVE" | "DISCONNECTED" | "BANNED" | undefined,
                    includeDeleted: query.includeDeleted === "true",
                },
                logger,
            );
        })
        .get("/telegram-sessions/:id", async ({ params, logger, set }) => {
            const result = await TelegramSessionsService.getSession(Number(params.id), logger);
            if (!result.success) {
                set.status = 404;
            }
            return result;
        })
        .post("/telegram-sessions/qr/start", async ({ body, logger, requestId }) => {
            return await TelegramSessionsService.startQrLogin(
                body as { name: string; phone: string; apiId: number; apiHash: string },
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        })
        .get("/telegram-sessions/qr/status", async ({ query, logger }) => {
            return await TelegramSessionsService.getQrStatus(query.token, logger);
        })
        .patch("/telegram-sessions/:id", async ({ params, body, logger, requestId, set }) => {
            const result = await TelegramSessionsService.updateSession(
                Number(params.id),
                body as { name?: string },
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
            if (!result.success) {
                set.status = 400;
            }
            return result;
        })
        .delete("/telegram-sessions/:id", async ({ params, logger, requestId, set }) => {
            const result = await TelegramSessionsService.deleteSession(
                Number(params.id),
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
            if (!result.success) {
                set.status = 400;
            }
            return result;
        })
        .post("/telegram-sessions/:id/disconnect", async ({ params, logger, requestId, set }) => {
            const result = await TelegramSessionsService.disconnectSession(
                Number(params.id),
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
            if (!result.success) {
                set.status = 400;
            }
            return result;
        })
        .post("/telegram-sessions/:id/reconnect", async ({ params, logger, requestId, set }) => {
            const result = await TelegramSessionsService.reconnectSession(
                Number(params.id),
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
            if (!result.success) {
                set.status = 400;
            }
            return result;
        });
};

describe("Telegram Sessions API Routes", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    // ─── GET / ──────────────────────────────────────────────────────

    describe("GET /telegram-sessions", () => {
        test("should return paginated sessions list", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([
                2,
                [mockSession, { ...mockSession, id: 2, name: "Session 2" }],
            ]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/telegram-sessions?page=1&limit=20"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(2);
            expect(body.data.sessions).toHaveLength(2);
        });

        test("should return empty list when no sessions exist", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([0, []]);

            // Act
            const response = await app.handle(new Request("http://localhost/telegram-sessions"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(0);
            expect(body.data.sessions).toHaveLength(0);
        });
    });

    // ─── GET /:id ───────────────────────────────────────────────────

    describe("GET /telegram-sessions/:id", () => {
        test("should return session by id", async () => {
            // Arrange
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(mockSession);

            // Act
            const response = await app.handle(new Request("http://localhost/telegram-sessions/1"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.id).toBe(1);
            expect(body.data.name).toBe("Test Session");
        });

        test("should return 404 when session not found", async () => {
            // Arrange
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(null);

            // Act
            const response = await app.handle(
                new Request("http://localhost/telegram-sessions/999"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(404);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Session not found");
        });
    });

    // ─── POST /qr/start ────────────────────────────────────────────

    describe("POST /telegram-sessions/qr/start", () => {
        test("should start QR login and return qrUrl + token", async () => {
            // Arrange
            const spy = vi.spyOn(TelegramSessionsService, "startQrLogin").mockResolvedValueOnce({
                success: true,
                data: { qrUrl: "tg://login?token=abc", token: "abc" },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/telegram-sessions/qr/start", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: "Session 1",
                        phone: "+998901234567",
                        apiId: 12345,
                        apiHash: "abc123",
                    }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.qrUrl).toBe("tg://login?token=abc");
            expect(body.data.token).toBe("abc");

            spy.mockRestore();
        });
    });

    // ─── GET /qr/status ─────────────────────────────────────────────

    describe("GET /telegram-sessions/qr/status", () => {
        test("should return QR status", async () => {
            // Arrange
            const spy = vi.spyOn(TelegramSessionsService, "getQrStatus").mockResolvedValueOnce({
                success: true,
                data: { status: "waiting" },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/telegram-sessions/qr/status?token=abc123"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.status).toBe("waiting");

            spy.mockRestore();
        });
    });

    // ─── PATCH /:id ─────────────────────────────────────────────────

    describe("PATCH /telegram-sessions/:id", () => {
        test("should update session name", async () => {
            // Arrange
            const existingSession = { ...mockSession, name: "Old Name" };
            const updatedSession = { ...mockSession, name: "New Name" };
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(existingSession);
            prismaMock.$transaction.mockImplementationOnce(async (callback) => {
                const mockTx = {
                    telegramSession: {
                        update: vi.fn(() => Promise.resolve(updatedSession)),
                    },
                    auditLog: { create: vi.fn(() => Promise.resolve({})) },
                };
                return (callback as (tx: unknown) => Promise<unknown>)(mockTx);
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/telegram-sessions/1", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "New Name" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.name).toBe("New Name");
        });

        test("should return 400 when session not found", async () => {
            // Arrange
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(null);

            // Act
            const response = await app.handle(
                new Request("http://localhost/telegram-sessions/999", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "New Name" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Session not found");
        });
    });

    // ─── DELETE /:id ────────────────────────────────────────────────

    describe("DELETE /telegram-sessions/:id", () => {
        test("should soft delete session", async () => {
            // Arrange
            const spy = vi.spyOn(TelegramSessionsService, "deleteSession").mockResolvedValueOnce({
                success: true,
                data: { ...mockSession, status: "DISCONNECTED", deletedAt: new Date() },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/telegram-sessions/1", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.status).toBe("DISCONNECTED");

            spy.mockRestore();
        });

        test("should return 400 when session not found", async () => {
            // Arrange
            const spy = vi.spyOn(TelegramSessionsService, "deleteSession").mockResolvedValueOnce({
                success: false,
                error: "Session not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/telegram-sessions/999", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Session not found");

            spy.mockRestore();
        });
    });

    // ─── POST /:id/disconnect ───────────────────────────────────────

    describe("POST /telegram-sessions/:id/disconnect", () => {
        test("should disconnect session", async () => {
            // Arrange
            const spy = vi
                .spyOn(TelegramSessionsService, "disconnectSession")
                .mockResolvedValueOnce({
                    success: true,
                    data: { ...mockSession, status: "DISCONNECTED" },
                });

            // Act
            const response = await app.handle(
                new Request("http://localhost/telegram-sessions/1/disconnect", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.status).toBe("DISCONNECTED");

            spy.mockRestore();
        });

        test("should return 400 when session not found", async () => {
            // Arrange
            const spy = vi
                .spyOn(TelegramSessionsService, "disconnectSession")
                .mockResolvedValueOnce({
                    success: false,
                    error: "Session not found",
                });

            // Act
            const response = await app.handle(
                new Request("http://localhost/telegram-sessions/999/disconnect", {
                    method: "POST",
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Session not found");

            spy.mockRestore();
        });
    });

    // ─── POST /:id/reconnect ────────────────────────────────────────

    describe("POST /telegram-sessions/:id/reconnect", () => {
        test("should reconnect session", async () => {
            // Arrange
            const spy = vi
                .spyOn(TelegramSessionsService, "reconnectSession")
                .mockResolvedValueOnce({
                    success: true,
                    data: { ...mockSession, status: "ACTIVE" },
                });

            // Act
            const response = await app.handle(
                new Request("http://localhost/telegram-sessions/1/reconnect", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.status).toBe("ACTIVE");

            spy.mockRestore();
        });

        test("should return 400 when session not found", async () => {
            // Arrange
            const spy = vi
                .spyOn(TelegramSessionsService, "reconnectSession")
                .mockResolvedValueOnce({
                    success: false,
                    error: "Session not found",
                });

            // Act
            const response = await app.handle(
                new Request("http://localhost/telegram-sessions/999/reconnect", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Session not found");

            spy.mockRestore();
        });
    });
});

describe("Telegram Sessions Service Integration", () => {
    test("getAllSessions should be called with correct pagination", async () => {
        // Arrange
        const spy = vi.spyOn(TelegramSessionsService, "getAllSessions").mockResolvedValue({
            success: true,
            data: { count: 0, sessions: [] },
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/telegram-sessions?page=3&limit=15"));

        // Assert
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({
                page: 3,
                limit: 15,
                sortBy: "id",
                sortOrder: "asc",
            }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("getSession should be called with correct id", async () => {
        // Arrange
        const spy = vi.spyOn(TelegramSessionsService, "getSession").mockResolvedValue({
            success: true,
            data: mockSession,
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/telegram-sessions/42"));

        // Assert
        expect(spy).toHaveBeenCalledWith(42, expect.anything());

        spy.mockRestore();
    });

    test("startQrLogin should be called with body and context", async () => {
        // Arrange
        const spy = vi.spyOn(TelegramSessionsService, "startQrLogin").mockResolvedValue({
            success: true,
            data: { qrUrl: "tg://login?token=x", token: "x" },
        });
        const app = createTestApp();

        // Act
        await app.handle(
            new Request("http://localhost/telegram-sessions/qr/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "S1",
                    phone: "+998901234567",
                    apiId: 111,
                    apiHash: "hash",
                }),
            }),
        );

        // Assert
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ name: "S1", phone: "+998901234567" }),
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("deleteSession should be called with context", async () => {
        // Arrange
        const spy = vi.spyOn(TelegramSessionsService, "deleteSession").mockResolvedValue({
            success: true,
            data: mockSession,
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/telegram-sessions/1", { method: "DELETE" }));

        // Assert
        expect(spy).toHaveBeenCalledWith(
            1,
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("updateSession should be called with body and context", async () => {
        // Arrange
        const spy = vi.spyOn(TelegramSessionsService, "updateSession").mockResolvedValue({
            success: true,
            data: { ...mockSession, name: "Updated" },
        });
        const app = createTestApp();

        // Act
        await app.handle(
            new Request("http://localhost/telegram-sessions/5", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "Updated" }),
            }),
        );

        // Assert
        expect(spy).toHaveBeenCalledWith(
            5,
            expect.objectContaining({ name: "Updated" }),
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.anything(),
        );

        spy.mockRestore();
    });
});

describe("Telegram Sessions API edge cases", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    test("GET /telegram-sessions/:id with id=0 should return not found", async () => {
        // Arrange
        prismaMock.telegramSession.findFirst.mockResolvedValueOnce(null);

        // Act
        const response = await app.handle(new Request("http://localhost/telegram-sessions/0"));
        const body = await response.json();

        // Assert
        expect(body.success).toBe(false);
        expect(body.error).toBe("Session not found");
    });

    test("GET /telegram-sessions with empty results should return empty list", async () => {
        // Arrange
        prismaMock.$transaction.mockResolvedValueOnce([0, []]);

        // Act
        const response = await app.handle(new Request("http://localhost/telegram-sessions"));
        const body = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.data.count).toBe(0);
        expect(body.data.sessions).toEqual([]);
    });

    test("DELETE /telegram-sessions/:id with id=0 should return not found", async () => {
        // Arrange
        const spy = vi.spyOn(TelegramSessionsService, "deleteSession").mockResolvedValueOnce({
            success: false,
            error: "Session not found",
        });

        // Act
        const response = await app.handle(
            new Request("http://localhost/telegram-sessions/0", { method: "DELETE" }),
        );
        const body = await response.json();

        // Assert
        expect(body.success).toBe(false);
        expect(body.error).toBe("Session not found");

        spy.mockRestore();
    });
});
