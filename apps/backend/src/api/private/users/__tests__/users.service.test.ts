import { describe, test, expect, beforeEach, mock } from "bun:test";
import { prismaMock, createMockLogger, expectSuccess, expectFailure } from "@backend/test/setup";
import { Users } from "../users.service";
import type { Token } from "@jahonbozor/schemas";
import crypto from "crypto";

// Helper to create transaction mock with callback support
const mockTransaction = (mockTx: unknown) => {
    prismaMock.$transaction.mockImplementation(async (callbackOrArray: unknown) => {
        if (typeof callbackOrArray === "function") {
            return (callbackOrArray as (tx: unknown) => Promise<unknown>)(mockTx);
        }
        throw new Error("Expected callback function");
    });
};

// Mock user data
const mockUser = {
    id: 1,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    fullname: "John Doe",
    username: "johndoe",
    phone: "+998901234567",
    photo: null,
    telegramId: "123456789",
    language: "uz",
    deletedAt: null,
};

const mockDeletedUser = {
    ...mockUser,
    deletedAt: new Date("2024-01-15"),
};

const mockUserWithOrders = {
    ...mockUser,
    orders: [{ id: 1, status: "NEW" }],
};

const mockStaffToken: Token = {
    id: 10,
    fullname: "Admin User",
    username: "admin",
    telegramId: "staff123456",
    roleId: 1,
    type: "staff",
};

const mockAuditContext = {
    staffId: mockStaffToken.id,
    user: mockStaffToken,
    requestId: "test-request-id",
};

describe("Users Service", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeEach(() => {
        mockLogger = createMockLogger();
    });

    describe("getAllUsers", () => {
        test("should return paginated users excluding deleted by default", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([5, [mockUser]]);

            // Act
            const result = await Users.getAllUsers(
                { page: 1, limit: 20, searchQuery: "", includeOrders: false },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ count: 5, users: [mockUser] });
        });

        test("should include deleted users when includeDeleted is true", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([6, [mockUser, mockDeletedUser]]);

            // Act
            const result = await Users.getAllUsers(
                { page: 1, limit: 20, searchQuery: "", includeOrders: false, includeDeleted: true },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.count).toBe(6);
            expect(success.data?.users).toHaveLength(2);
        });

        test("should apply searchQuery filter", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([1, [mockUser]]);

            // Act
            const result = await Users.getAllUsers(
                { page: 1, limit: 20, searchQuery: "John", includeOrders: false },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.users).toHaveLength(1);
        });

        test("should include orders when requested", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([1, [mockUserWithOrders]]);

            // Act
            const result = await Users.getAllUsers(
                { page: 1, limit: 20, searchQuery: "", includeOrders: true },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.users[0].orders).toBeDefined();
        });

        test("should return empty array when no users found", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([0, []]);

            // Act
            const result = await Users.getAllUsers(
                { page: 1, limit: 20, searchQuery: "nonexistent", includeOrders: false },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ count: 0, users: [] });
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database connection failed");
            prismaMock.$transaction.mockRejectedValue(dbError);

            // Act
            const result = await Users.getAllUsers(
                { page: 1, limit: 20, searchQuery: "", includeOrders: false },
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("getUser", () => {
        test("should return user by id", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValue(mockUser);

            // Act
            const result = await Users.getUser(1, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual(mockUser);
        });

        test("should return error when user not found", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValue(null);

            // Act
            const result = await Users.getUser(999, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("User not found");
            expect(mockLogger.warn).toHaveBeenCalledWith("Users: User not found", { userId: 999 });
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.users.findUnique.mockRejectedValue(dbError);

            // Act
            const result = await Users.getUser(1, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("createUser", () => {
        test("should create user with valid data and audit log", async () => {
            // Arrange
            const userData = {
                fullname: "Jane Doe",
                username: "janedoe",
                phone: "+998901234568",
                photo: null,
                telegramId: null,
            };
            const createdUser = { id: 2, ...userData, createdAt: new Date(), updatedAt: new Date(), deletedAt: null };

            mockTransaction({
                users: { create: mock(() => Promise.resolve(createdUser)) },
                auditLog: { create: mock(() => Promise.resolve({})) },
            });

            // Act
            const result = await Users.createUser(userData, mockAuditContext, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual(createdUser);
            expect(mockLogger.info).toHaveBeenCalledWith("Users: User created", {
                userId: 2,
                staffId: mockAuditContext.staffId,
            });
        });

        test("should handle database error", async () => {
            // Arrange
            const userData = {
                fullname: "Jane Doe",
                username: "janedoe",
                phone: "+998901234568",
                photo: null,
                telegramId: null,
            };
            const dbError = new Error("Unique constraint violation");
            prismaMock.$transaction.mockRejectedValue(dbError);

            // Act
            const result = await Users.createUser(userData, mockAuditContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("updateUser", () => {
        test("should update existing user", async () => {
            // Arrange
            const updateData = { fullname: "John Updated" };
            const updatedUser = { ...mockUser, ...updateData };

            prismaMock.users.findUnique.mockResolvedValue(mockUser);
            mockTransaction({
                users: { update: mock(() => Promise.resolve(updatedUser)) },
                auditLog: { create: mock(() => Promise.resolve({})) },
            });

            // Act
            const result = await Users.updateUser(1, updateData, mockAuditContext, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.fullname).toBe("John Updated");
            expect(mockLogger.info).toHaveBeenCalledWith("Users: User updated", {
                userId: 1,
                staffId: mockAuditContext.staffId,
            });
        });

        test("should return error when user not found", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValue(null);

            // Act
            const result = await Users.updateUser(999, { fullname: "Test" }, mockAuditContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("User not found");
        });

        test("should return error when trying to update deleted user", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValue(mockDeletedUser);

            // Act
            const result = await Users.updateUser(1, { fullname: "Test" }, mockAuditContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Cannot update deleted user");
            expect(mockLogger.warn).toHaveBeenCalledWith("Users: Cannot update deleted user", { userId: 1 });
        });
    });

    describe("deleteUser (soft delete)", () => {
        test("should soft delete existing user", async () => {
            // Arrange
            const softDeletedUser = { ...mockUser, deletedAt: new Date() };

            prismaMock.users.findUnique.mockResolvedValue(mockUser);
            mockTransaction({
                users: { update: mock(() => Promise.resolve(softDeletedUser)) },
                auditLog: { create: mock(() => Promise.resolve({})) },
            });

            // Act
            const result = await Users.deleteUser(1, mockAuditContext, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.deletedAt).not.toBeNull();
            expect(mockLogger.info).toHaveBeenCalledWith("Users: User deleted", {
                userId: 1,
                staffId: mockAuditContext.staffId,
            });
        });

        test("should return error when user not found", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValue(null);

            // Act
            const result = await Users.deleteUser(999, mockAuditContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("User not found");
            expect(mockLogger.warn).toHaveBeenCalledWith("Users: User not found for delete", { userId: 999 });
        });

        test("should return error when user already deleted", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValue(mockDeletedUser);

            // Act
            const result = await Users.deleteUser(1, mockAuditContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("User already deleted");
            expect(mockLogger.warn).toHaveBeenCalledWith("Users: User already deleted", { userId: 1 });
        });
    });

    describe("restoreUser", () => {
        test("should restore deleted user", async () => {
            // Arrange
            const restoredUser = { ...mockDeletedUser, deletedAt: null };

            prismaMock.users.findUnique.mockResolvedValue(mockDeletedUser);
            mockTransaction({
                users: { update: mock(() => Promise.resolve(restoredUser)) },
                auditLog: { create: mock(() => Promise.resolve({})) },
            });

            // Act
            const result = await Users.restoreUser(1, mockAuditContext, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.deletedAt).toBeNull();
            expect(mockLogger.info).toHaveBeenCalledWith("Users: User restored", {
                userId: 1,
                staffId: mockAuditContext.staffId,
            });
        });

        test("should return error when user not found", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValue(null);

            // Act
            const result = await Users.restoreUser(999, mockAuditContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("User not found");
        });

        test("should return error when user is not deleted", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValue(mockUser);

            // Act
            const result = await Users.restoreUser(1, mockAuditContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("User is not deleted");
            expect(mockLogger.warn).toHaveBeenCalledWith("Users: User is not deleted", { userId: 1 });
        });
    });

    describe("validateTelegramHash", () => {
        const botToken = "test_bot_token_12345";

        test("should return true for valid hash", () => {
            // Arrange
            const telegramData = {
                id: "123456789",
                first_name: "John",
                last_name: "Doe",
                username: "johndoe",
                photo_url: null,
                auth_date: 1704067200,
                hash: "",
            };

            // Compute valid hash
            const dataCheckString = Object.entries(telegramData)
                .filter(([key, value]) => key !== "hash" && value !== undefined)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => `${key}=${value}`)
                .join("\n");

            const secretKey = crypto.createHash("sha256").update(botToken).digest();
            const validHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

            telegramData.hash = validHash;

            // Act
            const result = Users.validateTelegramHash(telegramData, botToken);

            // Assert
            expect(result).toBe(true);
        });

        test("should return false for invalid hash", () => {
            // Arrange
            const telegramData = {
                id: "123456789",
                first_name: "John",
                last_name: "Doe",
                username: "johndoe",
                photo_url: null,
                auth_date: 1704067200,
                hash: "invalid_hash_value",
            };

            // Act
            const result = Users.validateTelegramHash(telegramData, botToken);

            // Assert
            expect(result).toBe(false);
        });
    });

    describe("createOrUpdateFromTelegram", () => {
        const telegramData = {
            id: "123456789",
            first_name: "John",
            last_name: "Doe",
            username: "johndoe",
            photo_url: "https://photo.url/avatar.jpg",
            auth_date: 1704067200,
            hash: "valid_hash",
        };

        test("should update existing user by telegramId with audit log", async () => {
            // Arrange
            const existingUser = { ...mockUser, telegramId: "123456789" };
            const updatedUser = { ...existingUser, fullname: "John Doe", photo: "https://photo.url/avatar.jpg" };

            prismaMock.users.findUnique.mockResolvedValue(existingUser);
            mockTransaction({
                users: { update: mock(() => Promise.resolve(updatedUser)) },
                auditLog: { create: mock(() => Promise.resolve({})) },
            });

            // Act
            const result = await Users.createOrUpdateFromTelegram(telegramData, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual(updatedUser);
            expect(mockLogger.info).toHaveBeenCalledWith("Users: Updated user from Telegram", {
                userId: updatedUser.id,
            });
        });

        test("should link existing user by phone with audit log", async () => {
            // Arrange
            const existingUserByPhone = { ...mockUser, telegramId: null, phone: "+998901234567" };
            const linkedUser = { ...existingUserByPhone, telegramId: "123456789" };

            prismaMock.users.findUnique
                .mockResolvedValueOnce(null) // no user by telegramId
                .mockResolvedValueOnce(existingUserByPhone); // found by phone

            mockTransaction({
                users: { update: mock(() => Promise.resolve(linkedUser)) },
                auditLog: { create: mock(() => Promise.resolve({})) },
            });

            // Act
            const result = await Users.createOrUpdateFromTelegram(telegramData, mockLogger, "+998901234567");

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual(linkedUser);
            expect(mockLogger.info).toHaveBeenCalledWith("Users: Linked Telegram to existing user", {
                userId: linkedUser.id,
                telegramId: "123456789",
            });
        });

        test("should create new user when not found with audit log", async () => {
            // Arrange
            const newUser = {
                id: 2,
                fullname: "John Doe",
                username: "johndoe",
                phone: null,
                telegramId: "123456789",
                photo: "https://photo.url/avatar.jpg",
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
            };

            prismaMock.users.findUnique.mockResolvedValue(null);
            mockTransaction({
                users: { create: mock(() => Promise.resolve(newUser)) },
                auditLog: { create: mock(() => Promise.resolve({})) },
            });

            // Act
            const result = await Users.createOrUpdateFromTelegram(telegramData, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual(newUser);
            expect(mockLogger.info).toHaveBeenCalledWith("Users: Created new user from Telegram", {
                userId: 2,
                telegramId: "123456789",
            });
        });

        test("should construct fullname from first_name and last_name", async () => {
            // Arrange
            const telegramDataWithLastName = {
                ...telegramData,
                first_name: "Jane",
                last_name: "Smith",
            };

            const newUser = {
                id: 3,
                fullname: "Jane Smith",
                username: "johndoe",
                phone: null,
                telegramId: "123456789",
                photo: "https://photo.url/avatar.jpg",
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
            };

            prismaMock.users.findUnique.mockResolvedValue(null);
            mockTransaction({
                users: { create: mock(() => Promise.resolve(newUser)) },
                auditLog: { create: mock(() => Promise.resolve({})) },
            });

            // Act
            const result = await Users.createOrUpdateFromTelegram(telegramDataWithLastName, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.fullname).toBe("Jane Smith");
        });

        test("should use telegramId as username when username is not provided", async () => {
            // Arrange
            const telegramDataNoUsername = {
                ...telegramData,
                username: null,
            };

            const newUser = {
                id: 4,
                fullname: "John Doe",
                username: "123456789",
                phone: null,
                telegramId: "123456789",
                photo: "https://photo.url/avatar.jpg",
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
            };

            prismaMock.users.findUnique.mockResolvedValue(null);
            mockTransaction({
                users: { create: mock(() => Promise.resolve(newUser)) },
                auditLog: { create: mock(() => Promise.resolve({})) },
            });

            // Act
            const result = await Users.createOrUpdateFromTelegram(telegramDataNoUsername, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.username).toBe("123456789");
        });

        test("should save language when creating new user", async () => {
            // Arrange
            const newUser = {
                id: 5,
                fullname: "John Doe",
                username: "johndoe",
                phone: null,
                telegramId: "123456789",
                photo: "https://photo.url/avatar.jpg",
                language: "ru",
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
            };

            const createMock = mock(() => Promise.resolve(newUser));
            prismaMock.users.findUnique.mockResolvedValue(null);
            mockTransaction({
                users: { create: createMock },
                auditLog: { create: mock(() => Promise.resolve({})) },
            });

            // Act
            const result = await Users.createOrUpdateFromTelegram(telegramData, mockLogger, undefined, "req-1", "ru");

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.language).toBe("ru");
            expect(createMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ language: "ru" }),
                }),
            );
        });

        test("should update language for existing user on login", async () => {
            // Arrange
            const existingUser = { ...mockUser, telegramId: "123456789", language: "uz" };
            const updatedUser = { ...existingUser, language: "ru" };

            const updateMock = mock(() => Promise.resolve(updatedUser));
            prismaMock.users.findUnique.mockResolvedValue(existingUser);
            mockTransaction({
                users: { update: updateMock },
                auditLog: { create: mock(() => Promise.resolve({})) },
            });

            // Act
            const result = await Users.createOrUpdateFromTelegram(telegramData, mockLogger, undefined, "req-1", "ru");

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.language).toBe("ru");
            expect(updateMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ language: "ru" }),
                }),
            );
        });

        test("should default to uz language when not specified", async () => {
            // Arrange
            const newUser = {
                id: 6,
                fullname: "John Doe",
                username: "johndoe",
                phone: null,
                telegramId: "123456789",
                photo: "https://photo.url/avatar.jpg",
                language: "uz",
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
            };

            prismaMock.users.findUnique.mockResolvedValue(null);
            mockTransaction({
                users: { create: mock(() => Promise.resolve(newUser)) },
                auditLog: { create: mock(() => Promise.resolve({})) },
            });

            // Act — no language parameter
            const result = await Users.createOrUpdateFromTelegram(telegramData, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.language).toBe("uz");
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.users.findUnique.mockRejectedValue(dbError);

            // Act
            const result = await Users.createOrUpdateFromTelegram(telegramData, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("edge cases", () => {
        test("getUser with id=0 should return not found", async () => {
            prismaMock.users.findUnique.mockResolvedValue(null);

            const result = await Users.getUser(0, mockLogger);

            const failure = expectFailure(result);
            expect(failure.error).toBe("User not found");
        });

        test("getUser with negative id should return not found", async () => {
            prismaMock.users.findUnique.mockResolvedValue(null);

            const result = await Users.getUser(-1, mockLogger);

            const failure = expectFailure(result);
            expect(failure.error).toBe("User not found");
        });

        test("updateUser with empty body should succeed", async () => {
            prismaMock.users.findUnique.mockResolvedValue(mockUser);
            prismaMock.users.update.mockResolvedValue(mockUser);
            prismaMock.auditLog.create.mockResolvedValue({} as never);

            const result = await Users.updateUser(1, {}, mockAuditContext, mockLogger);

            expectSuccess(result);
        });

        test("deleteUser with id=0 should return not found", async () => {
            prismaMock.users.findUnique.mockResolvedValue(null);

            const result = await Users.deleteUser(0, mockAuditContext, mockLogger);

            const failure = expectFailure(result);
            expect(failure.error).toBe("User not found");
        });

        test("restoreUser with id=0 should return not found", async () => {
            prismaMock.users.findUnique.mockResolvedValue(null);

            const result = await Users.restoreUser(0, mockAuditContext, mockLogger);

            const failure = expectFailure(result);
            expect(failure.error).toBe("User not found");
        });
    });
});
