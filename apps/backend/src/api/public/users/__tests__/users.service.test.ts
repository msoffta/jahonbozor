import crypto from "crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { UsersService } from "@backend/api/private/users/users.service";
import { AuthService } from "@backend/api/public/auth/auth.service";
import { createMockLogger, expectFailure, expectSuccess, prismaMock } from "@backend/test/setup";

// We need to import the service after mocks are set up
// The actual service will be created in users.service.ts
import { PublicUsersService } from "../users.service";

import type { Users as UsersType } from "@backend/generated/prisma/client";

// Mock sendContactRequest
vi.mock("@backend/lib/telegram", () => ({
    sendContactRequest: vi.fn(() => Promise.resolve()),
}));

// Mock @telegram-apps/init-data-node/web
const mockValidate = vi.fn();
const mockParse = vi.fn();
vi.mock("@telegram-apps/init-data-node/web", () => ({
    validate: (...args: unknown[]) => mockValidate(...args),
    parse: (...args: unknown[]) => mockParse(...args),
}));

// Mock user data
const mockUser: UsersType = {
    id: 1,
    fullname: "John Doe",
    phone: "+998901234567",
    photo: "https://photo.url/avatar.jpg",
    telegramId: "123456789",
    language: "uz",
    deletedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

const mockUserNoPhone: UsersType = {
    ...mockUser,
    id: 2,
    phone: null,
};

// Test bot token
const TEST_BOT_TOKEN = "test_bot_token_12345";

// Helper to compute valid Telegram hash
const computeTelegramHash = (data: Record<string, unknown>, botToken: string): string => {
    const dataCheckString = Object.entries(data)
        .filter(([key, value]) => key !== "hash" && value !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${String(value)}`)
        .join("\n");

    const secretKey = crypto.createHash("sha256").update(botToken).digest();
    return crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
};

// Mock JWT signer
const createMockJwt = () => ({
    sign: vi.fn((_payload: Record<string, unknown>) => Promise.resolve("mock-jwt-token")),
});

// Helper to create valid telegram body
const createTelegramBody = (overrides: Record<string, unknown> = {}) => {
    const data: Record<string, unknown> = {
        id: "123456789",
        first_name: "John",
        last_name: "Doe",
        username: "johndoe",
        photo_url: "https://photo.url/avatar.jpg",
        auth_date: Math.floor(Date.now() / 1000),
        ...overrides,
    };
    data.hash = computeTelegramHash(data, TEST_BOT_TOKEN);
    return data as {
        id: string;
        first_name: string;
        last_name: string | null;
        username: string | null;
        photo_url: string | null;
        auth_date: number;
        hash: string;
        language?: "uz" | "ru";
    };
};

// Helper to create transaction mock
const mockTransaction = (mockTx: unknown) => {
    prismaMock.$transaction.mockImplementation(async (callbackOrArray: unknown) => {
        if (typeof callbackOrArray === "function") {
            return (callbackOrArray as (tx: unknown) => Promise<unknown>)(mockTx);
        }
        throw new Error("Expected callback function");
    });
};

describe("PublicUsersService", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;
    let mockJwt: ReturnType<typeof createMockJwt>;
    const _originalEnv = process.env.TELEGRAM_BOT_TOKEN;

    beforeEach(() => {
        mockLogger = createMockLogger();
        mockJwt = createMockJwt();
        process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
    });

    describe("authenticateWithTelegram", () => {
        test("should authenticate new user via Telegram", async () => {
            // Arrange
            const body = createTelegramBody();
            prismaMock.users.findUnique.mockResolvedValue(null);
            mockTransaction({
                users: { create: () => Promise.resolve(mockUser) },
                auditLog: { create: () => Promise.resolve({}) },
            });
            const saveTokenSpy = vi.spyOn(AuthService, "saveRefreshToken").mockResolvedValue(true);

            // Act
            const result = await PublicUsersService.authenticateWithTelegram(
                body,
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toHaveProperty("user");
            expect(success.data).toHaveProperty("accessToken");
            expect(success.data).toHaveProperty("refreshToken");
            expect(success.data).toHaveProperty("refreshTokenExp");
            expect(mockLogger.info).toHaveBeenCalled();

            saveTokenSpy.mockRestore();
        });

        test("should authenticate existing user via Telegram", async () => {
            // Arrange
            const body = createTelegramBody();
            const updatedUser = { ...mockUser, fullname: "John Updated" };
            prismaMock.users.findUnique.mockResolvedValue(mockUser);
            mockTransaction({
                users: { update: () => Promise.resolve(updatedUser) },
                auditLog: { create: () => Promise.resolve({}) },
            });
            const saveTokenSpy = vi.spyOn(AuthService, "saveRefreshToken").mockResolvedValue(true);

            // Act
            const result = await PublicUsersService.authenticateWithTelegram(
                body,
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toHaveProperty("user");
            expect(success.data).toHaveProperty("accessToken");

            saveTokenSpy.mockRestore();
        });

        test("should return sendContactRequest flag when user has no phone", async () => {
            // Arrange
            const body = createTelegramBody();
            prismaMock.users.findUnique.mockResolvedValue(null);
            mockTransaction({
                users: { create: () => Promise.resolve(mockUserNoPhone) },
                auditLog: { create: () => Promise.resolve({}) },
            });
            const saveTokenSpy = vi.spyOn(AuthService, "saveRefreshToken").mockResolvedValue(true);

            // Act
            const result = await PublicUsersService.authenticateWithTelegram(
                body,
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toHaveProperty("shouldSendContactRequest", true);

            saveTokenSpy.mockRestore();
        });

        test("should return failure for invalid Telegram hash", async () => {
            // Arrange
            const body = createTelegramBody();
            body.hash = "invalid_hash_value";

            // Act
            const result = await PublicUsersService.authenticateWithTelegram(
                body,
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Invalid authentication data");
            expect(mockLogger.warn).toHaveBeenCalled();
        });

        test("should return failure for expired auth_date", async () => {
            // Arrange
            const body = createTelegramBody({
                auth_date: Math.floor(Date.now() / 1000) - 600, // 10 minutes ago
            });

            // Act
            const result = await PublicUsersService.authenticateWithTelegram(
                body,
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Authentication data expired");
            expect(mockLogger.warn).toHaveBeenCalled();
        });

        test("should return failure when TELEGRAM_BOT_TOKEN is not configured", async () => {
            // Arrange
            delete process.env.TELEGRAM_BOT_TOKEN;
            const body = createTelegramBody();

            // Act
            const result = await PublicUsersService.authenticateWithTelegram(
                body,
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Server configuration error");
            expect(mockLogger.error).toHaveBeenCalled();
        });

        test("should return failure when createOrUpdateFromTelegram fails", async () => {
            // Arrange
            const body = createTelegramBody();
            prismaMock.users.findUnique.mockRejectedValue(new Error("DB error"));

            // Act
            const result = await PublicUsersService.authenticateWithTelegram(
                body,
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert
            expectFailure(result);
        });

        test("should return failure when saveRefreshToken fails", async () => {
            // Arrange
            const body = createTelegramBody();
            prismaMock.users.findUnique.mockResolvedValue(null);
            mockTransaction({
                users: { create: () => Promise.resolve(mockUser) },
                auditLog: { create: () => Promise.resolve({}) },
            });
            const saveTokenSpy = vi.spyOn(AuthService, "saveRefreshToken").mockResolvedValue(null);

            // Act
            const result = await PublicUsersService.authenticateWithTelegram(
                body,
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Internal Server Error");
            expect(mockLogger.error).toHaveBeenCalled();

            saveTokenSpy.mockRestore();
        });

        test("should handle unhandled error gracefully", async () => {
            // Arrange
            const body = createTelegramBody();
            const spy = vi.spyOn(UsersService, "validateTelegramHash").mockImplementation(() => {
                throw new Error("Unexpected error");
            });

            // Act
            const result = await PublicUsersService.authenticateWithTelegram(
                body,
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Internal Server Error");
            expect(mockLogger.error).toHaveBeenCalled();

            spy.mockRestore();
        });

        test("should construct fullname from first_name only when last_name is null", async () => {
            // Arrange — last_name=null is included in hash (null !== undefined)
            const body = createTelegramBody({ last_name: null });

            const newUser = { ...mockUser, fullname: "John" };
            prismaMock.users.findUnique.mockResolvedValue(null);
            mockTransaction({
                users: { create: () => Promise.resolve(newUser) },
                auditLog: { create: () => Promise.resolve({}) },
            });
            const saveTokenSpy = vi.spyOn(AuthService, "saveRefreshToken").mockResolvedValue(true);

            // Act
            const result = await PublicUsersService.authenticateWithTelegram(
                body,
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toHaveProperty("user");

            saveTokenSpy.mockRestore();
        });

        test("should accept request when optional fields are undefined", async () => {
            // Arrange — Telegram omits fields when user has no last name/username/photo
            const data: Record<string, unknown> = {
                id: "987654321",
                first_name: "Jane",
                auth_date: Math.floor(Date.now() / 1000),
            };
            data.hash = computeTelegramHash(data, TEST_BOT_TOKEN);
            const body = data as {
                id: string;
                first_name: string;
                auth_date: number;
                hash: string;
            };

            const newUser = {
                ...mockUser,
                id: 2,
                fullname: "Jane",
                telegramId: "987654321",
            };
            prismaMock.users.findUnique.mockResolvedValue(null);
            mockTransaction({
                users: { create: () => Promise.resolve(newUser) },
                auditLog: { create: () => Promise.resolve({}) },
            });
            const saveTokenSpy = vi.spyOn(AuthService, "saveRefreshToken").mockResolvedValue(true);

            // Act
            const result = await PublicUsersService.authenticateWithTelegram(
                body as unknown as Parameters<
                    typeof PublicUsersService.authenticateWithTelegram
                >[0],
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert
            expectSuccess(result);

            saveTokenSpy.mockRestore();
        });

        test("should pass language to createOrUpdateFromTelegram", async () => {
            // Arrange
            const body = createTelegramBody({ language: "ru" });
            // Recalculate hash without language (it's not part of Telegram signed data)
            const dataForHash: Record<string, unknown> = { ...body };
            delete dataForHash.hash;
            delete dataForHash.language;
            body.hash = computeTelegramHash(dataForHash, TEST_BOT_TOKEN);

            prismaMock.users.findUnique.mockResolvedValue(null);
            mockTransaction({
                users: { create: () => Promise.resolve(mockUser) },
                auditLog: { create: () => Promise.resolve({}) },
            });
            const saveTokenSpy = vi.spyOn(AuthService, "saveRefreshToken").mockResolvedValue(true);
            const createOrUpdateSpy = vi.spyOn(UsersService, "createOrUpdateFromTelegram");

            // Act
            await PublicUsersService.authenticateWithTelegram(
                body as unknown as Parameters<
                    typeof PublicUsersService.authenticateWithTelegram
                >[0],
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert — language should be passed through
            expect(createOrUpdateSpy).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                undefined,
                "test-req",
                "ru",
            );

            saveTokenSpy.mockRestore();
            createOrUpdateSpy.mockRestore();
        });

        test("should generate both access and refresh JWT tokens", async () => {
            // Arrange
            const body = createTelegramBody();
            prismaMock.users.findUnique.mockResolvedValue(null);
            mockTransaction({
                users: { create: () => Promise.resolve(mockUser) },
                auditLog: { create: () => Promise.resolve({}) },
            });
            const saveTokenSpy = vi.spyOn(AuthService, "saveRefreshToken").mockResolvedValue(true);

            // Act
            await PublicUsersService.authenticateWithTelegram(
                body,
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert — jwt.sign called twice: once for refresh, once for access
            expect(mockJwt.sign).toHaveBeenCalledTimes(2);

            saveTokenSpy.mockRestore();
        });
    });

    describe("authenticateWithWebApp", () => {
        const validInitData =
            "query_id=AAHdF6IQ&user=%7B%22id%22%3A123456789%7D&auth_date=1662771648&hash=abc";
        const parsedInitData = {
            auth_date: new Date("2024-01-01T00:00:00Z"),
            hash: "abc123",
            user: {
                id: 123456789,
                first_name: "John",
                last_name: "Doe",
                photo_url: "https://photo.url/avatar.jpg",
            },
        };

        beforeEach(() => {
            mockValidate.mockReset();
            mockParse.mockReset();
        });

        test("should authenticate user with valid initData", async () => {
            // Arrange
            mockValidate.mockResolvedValue(undefined);
            mockParse.mockReturnValue(parsedInitData);
            prismaMock.users.findUnique.mockResolvedValue(null);
            mockTransaction({
                users: { create: () => Promise.resolve(mockUser) },
                auditLog: { create: () => Promise.resolve({}) },
            });
            const saveTokenSpy = vi.spyOn(AuthService, "saveRefreshToken").mockResolvedValue(true);

            // Act
            const result = await PublicUsersService.authenticateWithWebApp(
                { initData: validInitData },
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toHaveProperty("user");
            expect(success.data).toHaveProperty("accessToken");
            expect(success.data).toHaveProperty("refreshToken");
            expect(mockValidate).toHaveBeenCalledWith(validInitData, TEST_BOT_TOKEN, {
                expiresIn: 86400,
            });
            expect(mockLogger.info).toHaveBeenCalled();

            saveTokenSpy.mockRestore();
        });

        test("should return failure for invalid initData signature", async () => {
            // Arrange
            mockValidate.mockRejectedValue(new Error("Signature is invalid"));

            // Act
            const result = await PublicUsersService.authenticateWithWebApp(
                { initData: "invalid-data" },
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Invalid authentication data");
            expect(mockLogger.warn).toHaveBeenCalled();
        });

        test("should return failure for expired initData", async () => {
            // Arrange
            mockValidate.mockRejectedValue(new Error("Init data has expired"));

            // Act
            const result = await PublicUsersService.authenticateWithWebApp(
                { initData: "expired-data" },
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Invalid authentication data");
        });

        test("should return failure when initData has no user", async () => {
            // Arrange
            mockValidate.mockResolvedValue(undefined);
            mockParse.mockReturnValue({ auth_date: new Date(), hash: "abc", user: undefined });

            // Act
            const result = await PublicUsersService.authenticateWithWebApp(
                { initData: validInitData },
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Invalid authentication data");
            expect(mockLogger.warn).toHaveBeenCalled();
        });

        test("should return failure when TELEGRAM_BOT_TOKEN is not configured", async () => {
            // Arrange
            delete process.env.TELEGRAM_BOT_TOKEN;

            // Act
            const result = await PublicUsersService.authenticateWithWebApp(
                { initData: validInitData },
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Server configuration error");
            expect(mockLogger.error).toHaveBeenCalled();
        });

        test("should return sendContactRequest flag when user has no phone", async () => {
            // Arrange
            mockValidate.mockResolvedValue(undefined);
            mockParse.mockReturnValue(parsedInitData);
            prismaMock.users.findUnique.mockResolvedValue(null);
            mockTransaction({
                users: { create: () => Promise.resolve(mockUserNoPhone) },
                auditLog: { create: () => Promise.resolve({}) },
            });
            const saveTokenSpy = vi.spyOn(AuthService, "saveRefreshToken").mockResolvedValue(true);

            // Act
            const result = await PublicUsersService.authenticateWithWebApp(
                { initData: validInitData },
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toHaveProperty("shouldSendContactRequest", true);

            saveTokenSpy.mockRestore();
        });

        test("should return failure when saveRefreshToken fails", async () => {
            // Arrange
            mockValidate.mockResolvedValue(undefined);
            mockParse.mockReturnValue(parsedInitData);
            prismaMock.users.findUnique.mockResolvedValue(null);
            mockTransaction({
                users: { create: () => Promise.resolve(mockUser) },
                auditLog: { create: () => Promise.resolve({}) },
            });
            const saveTokenSpy = vi.spyOn(AuthService, "saveRefreshToken").mockResolvedValue(null);

            // Act
            const result = await PublicUsersService.authenticateWithWebApp(
                { initData: validInitData },
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Internal Server Error");

            saveTokenSpy.mockRestore();
        });

        test("should pass language to createOrUpdateFromTelegram", async () => {
            // Arrange
            mockValidate.mockResolvedValue(undefined);
            mockParse.mockReturnValue(parsedInitData);
            prismaMock.users.findUnique.mockResolvedValue(null);
            mockTransaction({
                users: { create: () => Promise.resolve(mockUser) },
                auditLog: { create: () => Promise.resolve({}) },
            });
            const saveTokenSpy = vi.spyOn(AuthService, "saveRefreshToken").mockResolvedValue(true);
            const createOrUpdateSpy = vi.spyOn(UsersService, "createOrUpdateFromTelegram");

            // Act
            await PublicUsersService.authenticateWithWebApp(
                { initData: validInitData, language: "ru" },
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert
            expect(createOrUpdateSpy).toHaveBeenCalledWith(
                expect.objectContaining({ id: "123456789", first_name: "John" }),
                expect.anything(),
                undefined,
                "test-req",
                "ru",
            );

            saveTokenSpy.mockRestore();
            createOrUpdateSpy.mockRestore();
        });

        test("should generate both access and refresh JWT tokens", async () => {
            // Arrange
            mockValidate.mockResolvedValue(undefined);
            mockParse.mockReturnValue(parsedInitData);
            prismaMock.users.findUnique.mockResolvedValue(null);
            mockTransaction({
                users: { create: () => Promise.resolve(mockUser) },
                auditLog: { create: () => Promise.resolve({}) },
            });
            const saveTokenSpy = vi.spyOn(AuthService, "saveRefreshToken").mockResolvedValue(true);

            // Act
            await PublicUsersService.authenticateWithWebApp(
                { initData: validInitData },
                mockJwt,
                { requestId: "test-req" },
                mockLogger,
            );

            // Assert — jwt.sign called twice: once for refresh, once for access
            expect(mockJwt.sign).toHaveBeenCalledTimes(2);

            saveTokenSpy.mockRestore();
        });
    });

    describe("updateLanguage", () => {
        const mockContext = { requestId: "test-req" };

        test("should update user language successfully", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValue(mockUser);
            mockTransaction({
                users: { update: () => Promise.resolve({ ...mockUser, language: "ru" }) },
                auditLog: { create: () => Promise.resolve({}) },
            });

            // Act
            const result = await PublicUsersService.updateLanguage(
                1,
                "ru",
                mockContext,
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ language: "ru" });
            expect(mockLogger.info).toHaveBeenCalled();
        });

        test("should return failure when user not found", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValue(null);

            // Act
            const result = await PublicUsersService.updateLanguage(
                999,
                "ru",
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("User not found");
            expect(mockLogger.warn).toHaveBeenCalled();
        });

        test("should handle database error gracefully", async () => {
            // Arrange
            prismaMock.users.findUnique.mockRejectedValue(new Error("DB connection failed"));

            // Act
            const result = await PublicUsersService.updateLanguage(
                1,
                "ru",
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Internal Server Error");
            expect(mockLogger.error).toHaveBeenCalled();
        });

        test("should accept uz language", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValue(mockUser);
            mockTransaction({
                users: { update: () => Promise.resolve({ ...mockUser, language: "uz" }) },
                auditLog: { create: () => Promise.resolve({}) },
            });

            // Act
            const result = await PublicUsersService.updateLanguage(
                1,
                "uz",
                mockContext,
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ language: "uz" });
        });
    });
});
