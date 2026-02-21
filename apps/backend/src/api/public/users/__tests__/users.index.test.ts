import { describe, test, expect, beforeEach, mock } from "bun:test";
import { Elysia } from "elysia";
import { prismaMock, createMockLogger, expectSuccess, expectFailure } from "@backend/test/setup";
import type { Users as UsersType } from "@backend/generated/prisma/client";
import { Users } from "@backend/api/private/users/users.service";
import crypto from "crypto";

// Mock user data
const mockUser: UsersType = {
    id: 1,
    fullname: "John Doe",
    username: "johndoe",
    phone: "+998901234567",
    photo: "https://photo.url/avatar.jpg",
    telegramId: "123456789",
    language: "uz",
    deletedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

// Test bot token
const TEST_BOT_TOKEN = "test_bot_token_12345";

// Helper to compute valid Telegram hash
const computeTelegramHash = (data: Record<string, unknown>, botToken: string): string => {
    const dataCheckString = Object.entries(data)
        .filter(([key, value]) => key !== "hash" && value !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");

    const secretKey = crypto.createHash("sha256").update(botToken).digest();
    return crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
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

// Create test app simulating public users endpoint
const createTestApp = () => {
    const mockLogger = createMockLogger();

    // Mock environment variable
    process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;

    return new Elysia()
        .derive(() => ({
            logger: mockLogger,
            requestId: "test-request-id",
        }))
        .post("/users/telegram", async ({ body, set, logger, requestId }) => {
            const telegramData = body as {
                id: string;
                first_name: string;
                last_name: string | null;
                username: string | null;
                photo_url: string | null;
                auth_date: number;
                hash: string;
            };

            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            if (!botToken) {
                set.status = 500;
                return { success: false, error: "Server configuration error" };
            }

            const isValidHash = Users.validateTelegramHash(telegramData, botToken);
            if (!isValidHash) {
                set.status = 401;
                return { success: false, error: "Invalid authentication data" };
            }

            // Check auth_date expiration (5 minutes)
            const authTimestamp = telegramData.auth_date * 1000;
            const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
            if (authTimestamp < fiveMinutesAgo) {
                set.status = 401;
                return { success: false, error: "Authentication data expired" };
            }

            const result = await Users.createOrUpdateFromTelegram(telegramData, logger, undefined, requestId);

            if (!result.success || !result.data) {
                set.status = 400;
                return result;
            }

            return {
                success: true,
                data: { user: result.data, token: "mock-jwt-token" },
            };
        });
};

describe("Public Users API - Telegram Authentication", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    describe("POST /users/telegram", () => {
        test("should authenticate new user via Telegram", async () => {
            // Arrange
            const telegramData = {
                id: "123456789",
                first_name: "John",
                last_name: "Doe",
                username: "johndoe",
                photo_url: "https://photo.url/avatar.jpg",
                auth_date: Math.floor(Date.now() / 1000), // Current time
                hash: "",
            };
            telegramData.hash = computeTelegramHash(telegramData, TEST_BOT_TOKEN);

            prismaMock.users.findUnique.mockResolvedValue(null); // No existing user
            mockTransaction({
                users: { create: () => Promise.resolve(mockUser) },
                auditLog: { create: () => Promise.resolve({}) },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/users/telegram", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(telegramData),
                }),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            const success = expectSuccess(body);
            expect(success.data?.user).toBeDefined();
            expect(success.data?.token).toBeDefined();
        });

        test("should update existing user via Telegram", async () => {
            // Arrange
            const telegramData = {
                id: "123456789",
                first_name: "John",
                last_name: "Updated",
                username: "johndoe",
                photo_url: "https://photo.url/new-avatar.jpg",
                auth_date: Math.floor(Date.now() / 1000),
                hash: "",
            };
            telegramData.hash = computeTelegramHash(telegramData, TEST_BOT_TOKEN);

            const updatedUser = { ...mockUser, fullname: "John Updated" };
            prismaMock.users.findUnique.mockResolvedValue(mockUser); // Existing user
            mockTransaction({
                users: { update: () => Promise.resolve(updatedUser) },
                auditLog: { create: () => Promise.resolve({}) },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/users/telegram", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(telegramData),
                }),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            const success = expectSuccess(body);
            expect(success.data?.user).toBeDefined();
        });

        test("should return 401 for invalid hash", async () => {
            // Arrange
            const telegramData = {
                id: "123456789",
                first_name: "John",
                last_name: "Doe",
                username: "johndoe",
                photo_url: null,
                auth_date: Math.floor(Date.now() / 1000),
                hash: "invalid_hash_value",
            };

            // Act
            const response = await app.handle(
                new Request("http://localhost/users/telegram", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(telegramData),
                }),
            );

            // Assert
            expect(response.status).toBe(401);
            const body = await response.json();
            const failure = expectFailure(body);
            expect(failure.error).toBe("Invalid authentication data");
        });

        test("should return 401 for expired auth_date", async () => {
            // Arrange
            const telegramData = {
                id: "123456789",
                first_name: "John",
                last_name: "Doe",
                username: "johndoe",
                photo_url: null,
                auth_date: Math.floor(Date.now() / 1000) - 600, // 10 minutes ago
                hash: "",
            };
            telegramData.hash = computeTelegramHash(telegramData, TEST_BOT_TOKEN);

            // Act
            const response = await app.handle(
                new Request("http://localhost/users/telegram", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(telegramData),
                }),
            );

            // Assert
            expect(response.status).toBe(401);
            const body = await response.json();
            const failure = expectFailure(body);
            expect(failure.error).toBe("Authentication data expired");
        });

        test("should construct fullname from first_name only when last_name is null", async () => {
            // Arrange
            const telegramData = {
                id: "987654321",
                first_name: "Jane",
                last_name: null,
                username: null,
                photo_url: null,
                auth_date: Math.floor(Date.now() / 1000),
                hash: "",
            };
            telegramData.hash = computeTelegramHash(telegramData, TEST_BOT_TOKEN);

            const newUser = {
                ...mockUser,
                id: 2,
                fullname: "Jane",
                username: "987654321",
                telegramId: "987654321",
            };

            prismaMock.users.findUnique.mockResolvedValue(null);
            mockTransaction({
                users: { create: () => Promise.resolve(newUser) },
                auditLog: { create: () => Promise.resolve({}) },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/users/telegram", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(telegramData),
                }),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
        });

        test("should accept request when last_name, username, photo_url are undefined", async () => {
            // Arrange — Telegram omits these fields when user has no last name/username/photo
            const telegramData: Record<string, unknown> = {
                id: "987654321",
                first_name: "Jane",
                auth_date: Math.floor(Date.now() / 1000),
                hash: "",
            };
            telegramData.hash = computeTelegramHash(telegramData, TEST_BOT_TOKEN);

            const newUser = {
                ...mockUser,
                id: 2,
                fullname: "Jane",
                username: "987654321",
                telegramId: "987654321",
                photo: null,
            };

            prismaMock.users.findUnique.mockResolvedValue(null);
            mockTransaction({
                users: { create: () => Promise.resolve(newUser) },
                auditLog: { create: () => Promise.resolve({}) },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/users/telegram", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(telegramData),
                }),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
        });

        test("should handle database error gracefully", async () => {
            // Arrange
            const telegramData = {
                id: "123456789",
                first_name: "John",
                last_name: "Doe",
                username: "johndoe",
                photo_url: null,
                auth_date: Math.floor(Date.now() / 1000),
                hash: "",
            };
            telegramData.hash = computeTelegramHash(telegramData, TEST_BOT_TOKEN);

            const dbError = new Error("Database connection failed");
            prismaMock.users.findUnique.mockRejectedValue(dbError);

            // Act
            const response = await app.handle(
                new Request("http://localhost/users/telegram", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(telegramData),
                }),
            );

            // Assert
            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.success).toBe(false);
        });
    });
});
