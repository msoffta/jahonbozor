import { beforeEach, describe, expect, test, vi } from "vitest";

import { createMockLogger, expectFailure, expectSuccess, prismaMock } from "@backend/test/setup";

import { TelegramSessionsService } from "../telegram-sessions.service";

// --- Mock mtproto module ---
const mockInitQrLogin = vi.fn();
const mockPollQrStatus = vi.fn();
const mockDisconnectClient = vi.fn();
const mockConnectClient = vi.fn();

vi.mock("@backend/lib/mtproto", () => ({
    initQrLogin: (...args: unknown[]) => mockInitQrLogin(...args),
    pollQrStatus: (...args: unknown[]) => mockPollQrStatus(...args),
    disconnectClient: (...args: unknown[]) => mockDisconnectClient(...args),
    connectClient: (...args: unknown[]) => mockConnectClient(...args),
}));

// --- Mock audit & snapshots (used internally by service) ---
vi.mock("@backend/lib/audit", () => ({
    auditInTransaction: vi.fn(() => Promise.resolve()),
}));

vi.mock("@backend/lib/snapshots", () => ({
    createTelegramSessionSnapshot: vi.fn((s: unknown) => s),
}));

describe("TelegramSessionsService", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

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

    const createMockSession = (overrides = {}) => ({
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
        ...overrides,
    });

    beforeEach(() => {
        mockLogger = createMockLogger();
        mockInitQrLogin.mockReset();
        mockPollQrStatus.mockReset();
        mockDisconnectClient.mockReset();
        mockConnectClient.mockReset();
    });

    // ─── getAllSessions ──────────────────────────────────────────────

    describe("getAllSessions", () => {
        test("should return list with count", async () => {
            // Arrange
            const sessions = [
                createMockSession({ id: 1, name: "Session 1" }),
                createMockSession({ id: 2, name: "Session 2" }),
            ];
            prismaMock.$transaction.mockResolvedValueOnce([2, sessions]);

            // Act
            const result = await TelegramSessionsService.getAllSessions(
                {
                    page: 1,
                    limit: 10,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: "",
                },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; sessions: unknown[] };
            expect(data.count).toBe(2);
            expect(data.sessions).toHaveLength(2);
        });

        test("should filter by status", async () => {
            // Arrange
            const sessions = [createMockSession({ id: 1, status: "DISCONNECTED" })];
            prismaMock.$transaction.mockResolvedValueOnce([1, sessions]);

            // Act
            const result = await TelegramSessionsService.getAllSessions(
                {
                    page: 1,
                    limit: 10,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: "",
                    status: "DISCONNECTED",
                },
                mockLogger,
            );

            // Assert
            expectSuccess(result);
        });

        test("should filter by searchQuery", async () => {
            // Arrange
            const sessions = [createMockSession({ id: 1, name: "Marketing" })];
            prismaMock.$transaction.mockResolvedValueOnce([1, sessions]);

            // Act
            const result = await TelegramSessionsService.getAllSessions(
                {
                    page: 1,
                    limit: 10,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: "Market",
                },
                mockLogger,
            );

            // Assert
            expectSuccess(result);
        });

        test("should include deleted when includeDeleted=true", async () => {
            // Arrange
            const sessions = [
                createMockSession({ id: 1 }),
                createMockSession({ id: 2, deletedAt: new Date() }),
            ];
            prismaMock.$transaction.mockResolvedValueOnce([2, sessions]);

            // Act
            const result = await TelegramSessionsService.getAllSessions(
                {
                    page: 1,
                    limit: 10,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: "",
                    includeDeleted: true,
                },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; sessions: unknown[] };
            expect(data.count).toBe(2);
            expect(data.sessions).toHaveLength(2);
        });

        test("should return empty list when no sessions exist", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([0, []]);

            // Act
            const result = await TelegramSessionsService.getAllSessions(
                {
                    page: 1,
                    limit: 10,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: "",
                },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; sessions: unknown[] };
            expect(data.count).toBe(0);
            expect(data.sessions).toHaveLength(0);
        });
    });

    // ─── getSession ─────────────────────────────────────────────────

    describe("getSession", () => {
        test("should return session by id", async () => {
            // Arrange
            const session = createMockSession({ id: 1 });
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(session);

            // Act
            const result = await TelegramSessionsService.getSession(1, mockLogger);

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { id: number; name: string };
            expect(data.id).toBe(1);
            expect(data.name).toBe("Test Session");
        });

        test("should return error when session not found", async () => {
            // Arrange
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await TelegramSessionsService.getSession(999, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Session not found");
        });

        test("should return error for deleted session", async () => {
            // Arrange — findFirst with deletedAt: null filter returns null for deleted records
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await TelegramSessionsService.getSession(1, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Session not found");
        });

        test("should return error for id=0", async () => {
            // Arrange
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await TelegramSessionsService.getSession(0, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Session not found");
        });

        test("should return error for negative id", async () => {
            // Arrange
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await TelegramSessionsService.getSession(-1, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Session not found");
        });
    });

    // ─── startQrLogin ───────────────────────────────────────────────

    describe("startQrLogin", () => {
        test("should call initQrLogin and return qrUrl + token", async () => {
            // Arrange
            mockInitQrLogin.mockResolvedValueOnce({
                qrUrl: "tg://login?token=abc123",
                token: "abc123",
            });

            // Act
            const result = await TelegramSessionsService.startQrLogin(
                { name: "Session 1", phone: "+998901234567", apiId: 12345, apiHash: "abc123" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { qrUrl: string; token: string };
            expect(data.qrUrl).toBe("tg://login?token=abc123");
            expect(data.token).toBe("abc123");
            expect(mockInitQrLogin).toHaveBeenCalledWith(
                {
                    name: "Session 1",
                    phone: "+998901234567",
                    apiId: 12345,
                    apiHash: "abc123",
                },
                mockLogger,
            );
        });

        test("should return error when mtproto throws", async () => {
            // Arrange
            mockInitQrLogin.mockRejectedValueOnce(new Error("MTProto connection failed"));

            // Act
            const result = await TelegramSessionsService.startQrLogin(
                { name: "Session 1", phone: "+998901234567", apiId: 12345, apiHash: "abc123" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBeInstanceOf(Error);
        });
    });

    // ─── getQrStatus ────────────────────────────────────────────────

    describe("getQrStatus", () => {
        test("should return waiting status", async () => {
            // Arrange
            mockPollQrStatus.mockResolvedValueOnce({ status: "waiting" });

            // Act
            const result = await TelegramSessionsService.getQrStatus("token-123", mockLogger);

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { status: string };
            expect(data.status).toBe("waiting");
        });

        test("should return authenticated status with sessionId", async () => {
            // Arrange
            mockPollQrStatus.mockResolvedValueOnce({ status: "authenticated", sessionId: 42 });

            // Act
            const result = await TelegramSessionsService.getQrStatus("token-123", mockLogger);

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { status: string; sessionId: number };
            expect(data.status).toBe("authenticated");
            expect(data.sessionId).toBe(42);
        });

        test("should return expired status", async () => {
            // Arrange
            mockPollQrStatus.mockResolvedValueOnce({ status: "expired" });

            // Act
            const result = await TelegramSessionsService.getQrStatus("token-123", mockLogger);

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { status: string };
            expect(data.status).toBe("expired");
        });

        test("should return error when mtproto throws", async () => {
            // Arrange
            mockPollQrStatus.mockRejectedValueOnce(new Error("Poll failed"));

            // Act
            const result = await TelegramSessionsService.getQrStatus("token-123", mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBeInstanceOf(Error);
        });
    });

    // ─── updateSession ──────────────────────────────────────────────

    describe("updateSession", () => {
        test("should update session name", async () => {
            // Arrange
            const existingSession = createMockSession({ id: 1, name: "Old Name" });
            const updatedSession = createMockSession({ id: 1, name: "New Name" });
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(existingSession);
            prismaMock.$transaction.mockImplementationOnce(async (callback: any) => {
                const mockTx = {
                    telegramSession: {
                        update: vi.fn(() => Promise.resolve(updatedSession)),
                    },
                    auditLog: { create: vi.fn(() => Promise.resolve({})) },
                };
                return callback(mockTx);
            });

            // Act
            const result = await TelegramSessionsService.updateSession(
                1,
                { name: "New Name" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { id: number; name: string };
            expect(data.name).toBe("New Name");
        });

        test("should return error when session not found", async () => {
            // Arrange
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await TelegramSessionsService.updateSession(
                999,
                { name: "New Name" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Session not found");
        });

        test("should return error for deleted session", async () => {
            // Arrange — findFirst with deletedAt: null returns null for deleted records
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await TelegramSessionsService.updateSession(
                1,
                { name: "New Name" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Session not found");
        });
    });

    // ─── deleteSession ──────────────────────────────────────────────

    describe("deleteSession", () => {
        test("should soft delete and disconnect client", async () => {
            // Arrange
            const existingSession = createMockSession({ id: 1 });
            const deletedSession = createMockSession({
                id: 1,
                status: "DISCONNECTED",
                deletedAt: new Date(),
            });
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(existingSession);
            mockDisconnectClient.mockResolvedValueOnce(undefined);
            prismaMock.$transaction.mockImplementationOnce(async (callback: any) => {
                const mockTx = {
                    telegramSession: {
                        update: vi.fn(() => Promise.resolve(deletedSession)),
                    },
                    auditLog: { create: vi.fn(() => Promise.resolve({})) },
                };
                return callback(mockTx);
            });

            // Act
            const result = await TelegramSessionsService.deleteSession(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(mockDisconnectClient).toHaveBeenCalledWith(1, mockLogger);
            const data = success.data as { status: string; deletedAt: Date | null };
            expect(data.status).toBe("DISCONNECTED");
            expect(data.deletedAt).not.toBeNull();
        });

        test("should return error when session not found", async () => {
            // Arrange
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await TelegramSessionsService.deleteSession(
                999,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Session not found");
        });

        test("should still delete if disconnect fails", async () => {
            // Arrange
            const existingSession = createMockSession({ id: 1 });
            const deletedSession = createMockSession({
                id: 1,
                status: "DISCONNECTED",
                deletedAt: new Date(),
            });
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(existingSession);
            mockDisconnectClient.mockRejectedValueOnce(new Error("Connection lost"));
            prismaMock.$transaction.mockImplementationOnce(async (callback: any) => {
                const mockTx = {
                    telegramSession: {
                        update: vi.fn(() => Promise.resolve(deletedSession)),
                    },
                    auditLog: { create: vi.fn(() => Promise.resolve({})) },
                };
                return callback(mockTx);
            });

            // Act
            const result = await TelegramSessionsService.deleteSession(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            expectSuccess(result);
            expect(mockDisconnectClient).toHaveBeenCalledWith(1, mockLogger);
            // Disconnect failure is caught and logged, not propagated
            expect(mockLogger.warn).toHaveBeenCalled();
        });
    });

    // ─── disconnectSession ──────────────────────────────────────────

    describe("disconnectSession", () => {
        test("should disconnect and update status", async () => {
            // Arrange
            const existingSession = createMockSession({ id: 1, status: "ACTIVE" });
            const disconnectedSession = createMockSession({ id: 1, status: "DISCONNECTED" });
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(existingSession);
            mockDisconnectClient.mockResolvedValueOnce(undefined);
            prismaMock.$transaction.mockImplementationOnce(async (callback: any) => {
                const mockTx = {
                    telegramSession: {
                        update: vi.fn(() => Promise.resolve(disconnectedSession)),
                    },
                    auditLog: { create: vi.fn(() => Promise.resolve({})) },
                };
                return callback(mockTx);
            });

            // Act
            const result = await TelegramSessionsService.disconnectSession(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { id: number; status: string };
            expect(data.status).toBe("DISCONNECTED");
            expect(mockDisconnectClient).toHaveBeenCalledWith(1, mockLogger);
        });

        test("should return error when session not found", async () => {
            // Arrange
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await TelegramSessionsService.disconnectSession(
                999,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Session not found");
        });

        test("should return error when disconnectClient throws", async () => {
            // Arrange
            const existingSession = createMockSession({ id: 1, status: "ACTIVE" });
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(existingSession);
            mockDisconnectClient.mockRejectedValueOnce(new Error("Disconnect failed"));

            // Act
            const result = await TelegramSessionsService.disconnectSession(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBeInstanceOf(Error);
        });
    });

    // ─── reconnectSession ───────────────────────────────────────────

    describe("reconnectSession", () => {
        test("should reconnect and update status", async () => {
            // Arrange
            const existingSession = createMockSession({ id: 1, status: "DISCONNECTED" });
            const reconnectedSession = createMockSession({ id: 1, status: "ACTIVE" });
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(existingSession);
            mockConnectClient.mockResolvedValueOnce(undefined);
            prismaMock.$transaction.mockImplementationOnce(async (callback: any) => {
                const mockTx = {
                    telegramSession: {
                        update: vi.fn(() => Promise.resolve(reconnectedSession)),
                    },
                    auditLog: { create: vi.fn(() => Promise.resolve({})) },
                };
                return callback(mockTx);
            });

            // Act
            const result = await TelegramSessionsService.reconnectSession(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { id: number; status: string };
            expect(data.status).toBe("ACTIVE");
            expect(mockConnectClient).toHaveBeenCalledWith(1, mockLogger);
        });

        test("should return error when session not found", async () => {
            // Arrange
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await TelegramSessionsService.reconnectSession(
                999,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Session not found");
        });

        test("should return error when connectClient throws", async () => {
            // Arrange
            const existingSession = createMockSession({ id: 1, status: "DISCONNECTED" });
            prismaMock.telegramSession.findFirst.mockResolvedValueOnce(existingSession);
            mockConnectClient.mockRejectedValueOnce(new Error("Connect failed"));

            // Act
            const result = await TelegramSessionsService.reconnectSession(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBeInstanceOf(Error);
        });
    });
});
