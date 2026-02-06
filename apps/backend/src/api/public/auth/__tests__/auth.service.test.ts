import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { prismaMock, createMockLogger } from "@test/setup";
import type { Staff, RefreshToken, Users } from "@generated/prisma/client";
import { password } from "bun";
import Auth from "../auth.service";

const mockStaff: Staff = {
    id: 1,
    fullname: "John Doe",
    username: "johndoe",
    passwordHash: "$argon2id$v=19$m=65536,t=2,p=1$hash",
    telegramId: BigInt(123456789),
    roleId: 1,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

const mockStaffQuery = {
    id: 1,
    fullname: "John Doe",
    username: "johndoe",
    passwordHash: "$argon2id$v=19$m=65536,t=2,p=1$hash",
    roleId: 1,
};

const mockRefreshToken: RefreshToken = {
    id: 1,
    token: "valid-refresh-token",
    staffId: 1,
    userId: null,
    expiredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    revoked: false,
    userAgent: null,
    ipAddress: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

const mockStaffWithRole = {
    id: 1,
    fullname: "John Doe",
    username: "johndoe",
    telegramId: "123456789",
    roleId: 1,
    role: {
        id: 1,
        name: "Admin",
        permissions: ["products:read", "products:create"],
    },
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
} as unknown as Awaited<ReturnType<typeof Auth.getStaffById>>;

const mockUserDb: Users = {
    id: 1,
    fullname: "Test User",
    username: "testuser",
    phone: "+998901234567",
    telegramId: "987654321",
    photo: null,
    deletedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

const mockUserResult = {
    id: 1,
    fullname: "Test User",
    username: "testuser",
    phone: "+998901234567",
    telegramId: "987654321",
    photo: null,
    deletedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

describe("Auth Service", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;
    let passwordVerifySpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        mockLogger = createMockLogger();
        passwordVerifySpy = spyOn(password, "verify");
    });

    describe("checkIfStaffExists", () => {
        test("should return staff with type when credentials are valid", async () => {
            // Arrange
            prismaMock.staff.findFirst.mockResolvedValueOnce(mockStaffQuery as unknown as Staff);
            passwordVerifySpy.mockResolvedValueOnce(true);

            // Act
            const result = await Auth.checkIfStaffExists(
                { username: "johndoe", password: "correctpassword" },
                mockLogger,
            );

            // Assert
            expect(result).not.toBeNull();
            expect(result?.id).toBe(1);
            expect(result?.type).toBe("staff");
            expect(result?.fullname).toBe("John Doe");
            expect(mockLogger.info).toHaveBeenCalledWith("Auth: Staff login successful", {
                staffId: 1,
                username: "johndoe",
            });
        });

        test("should return null when staff not found", async () => {
            // Arrange
            prismaMock.staff.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await Auth.checkIfStaffExists(
                { username: "nonexistent", password: "anypassword" },
                mockLogger,
            );

            // Assert
            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith("Auth: Staff not found", {
                username: "nonexistent",
            });
        });

        test("should return null when password is incorrect", async () => {
            // Arrange
            prismaMock.staff.findFirst.mockResolvedValueOnce(mockStaffQuery as unknown as Staff);
            passwordVerifySpy.mockResolvedValueOnce(false);

            // Act
            const result = await Auth.checkIfStaffExists(
                { username: "johndoe", password: "wrongpassword" },
                mockLogger,
            );

            // Assert
            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith("Auth: Password mismatch", {
                username: "johndoe",
            });
        });

        test("should throw error when database fails", async () => {
            // Arrange
            const dbError = new Error("Database connection failed");
            prismaMock.staff.findFirst.mockRejectedValueOnce(dbError);

            // Act & Assert
            await expect(
                Auth.checkIfStaffExists(
                    { username: "johndoe", password: "anypassword" },
                    mockLogger,
                ),
            ).rejects.toThrow("Auth: Failed to login user");
            expect(mockLogger.error).toHaveBeenCalledWith("Auth: Error in checkIfStaffExists", {
                username: "johndoe",
                error: dbError,
            });
        });
    });

    describe("saveRefreshToken", () => {
        test("should return true when token is saved successfully", async () => {
            // Arrange
            prismaMock.refreshToken.create.mockResolvedValueOnce(mockRefreshToken);

            // Act
            const result = await Auth.saveRefreshToken(
                {
                    token: "new-token",
                    exp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    staffId: 1,
                },
                mockLogger,
            );

            // Assert
            expect(result).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith("Auth: Refresh token saved", {
                staffId: 1,
            });
        });

        test("should return null when database error occurs", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.refreshToken.create.mockRejectedValueOnce(dbError);

            // Act
            const result = await Auth.saveRefreshToken(
                {
                    token: "new-token",
                    exp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    staffId: 1,
                },
                mockLogger,
            );

            // Assert
            expect(result).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith("Auth: Error in saveRefreshToken", {
                staffId: 1,
                error: dbError,
            });
        });
    });

    describe("validateRefreshToken", () => {
        test("should return token record when valid", async () => {
            // Arrange
            const validToken = {
                id: 1,
                staffId: 1,
                userId: null,
                revoked: false,
                expiredAt: new Date(Date.now() + 1000 * 60 * 60),
            };
            prismaMock.refreshToken.findUnique.mockResolvedValueOnce(validToken as unknown as RefreshToken);

            // Act
            const result = await Auth.validateRefreshToken("valid-token", mockLogger);

            // Assert
            expect(result).toEqual(validToken);
        });

        test("should return null when token not found", async () => {
            // Arrange
            prismaMock.refreshToken.findUnique.mockResolvedValueOnce(null);

            // Act
            const result = await Auth.validateRefreshToken("nonexistent-token", mockLogger);

            // Assert
            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith("Auth: Refresh token not found");
        });

        test("should return null when token is revoked", async () => {
            // Arrange
            const revokedToken = {
                id: 1,
                staffId: 1,
                userId: null,
                revoked: true,
                expiredAt: new Date(Date.now() + 1000 * 60 * 60),
            };
            prismaMock.refreshToken.findUnique.mockResolvedValueOnce(revokedToken as unknown as RefreshToken);

            // Act
            const result = await Auth.validateRefreshToken("revoked-token", mockLogger);

            // Assert
            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith("Auth: Refresh token is revoked", {
                tokenId: 1,
            });
        });

        test("should return null when token is expired", async () => {
            // Arrange
            const expiredToken = {
                id: 1,
                staffId: 1,
                userId: null,
                revoked: false,
                expiredAt: new Date(Date.now() - 1000),
            };
            prismaMock.refreshToken.findUnique.mockResolvedValueOnce(expiredToken as unknown as RefreshToken);

            // Act
            const result = await Auth.validateRefreshToken("expired-token", mockLogger);

            // Assert
            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith("Auth: Refresh token expired", {
                tokenId: 1,
            });
        });

        test("should return null when database error occurs", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.refreshToken.findUnique.mockRejectedValueOnce(dbError);

            // Act
            const result = await Auth.validateRefreshToken("any-token", mockLogger);

            // Assert
            expect(result).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith("Auth: Error in validateRefreshToken", {
                error: dbError,
            });
        });
    });

    describe("revokeRefreshToken", () => {
        test("should revoke token successfully", async () => {
            // Arrange
            prismaMock.refreshToken.update.mockResolvedValueOnce({
                ...mockRefreshToken,
                revoked: true,
            });

            // Act
            await Auth.revokeRefreshToken("valid-token", mockLogger);

            // Assert
            expect(prismaMock.refreshToken.update).toHaveBeenCalledWith({
                where: { token: "valid-token" },
                data: { revoked: true },
            });
            expect(mockLogger.info).toHaveBeenCalledWith("Auth: Refresh token revoked");
        });

        test("should log error when database fails", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.refreshToken.update.mockRejectedValueOnce(dbError);

            // Act
            await Auth.revokeRefreshToken("any-token", mockLogger);

            // Assert
            expect(mockLogger.error).toHaveBeenCalledWith("Auth: Error in revokeRefreshToken", {
                error: dbError,
            });
        });
    });

    describe("getStaffById", () => {
        test("should return staff with role when found", async () => {
            // Arrange
            prismaMock.staff.findUnique.mockResolvedValueOnce(mockStaffWithRole as unknown as Staff);

            // Act
            const result = await Auth.getStaffById(1, mockLogger);

            // Assert
            expect(result).toEqual(mockStaffWithRole);
        });

        test("should return null when staff not found", async () => {
            // Arrange
            prismaMock.staff.findUnique.mockResolvedValueOnce(null);

            // Act
            const result = await Auth.getStaffById(999, mockLogger);

            // Assert
            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith("Auth: Staff not found by id", {
                staffId: 999,
            });
        });

        test("should return null when database error occurs", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.staff.findUnique.mockRejectedValueOnce(dbError);

            // Act
            const result = await Auth.getStaffById(1, mockLogger);

            // Assert
            expect(result).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith("Auth: Error in getStaffById", {
                staffId: 1,
                error: dbError,
            });
        });
    });

    describe("getUserById", () => {
        test("should return user when found", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValueOnce(mockUserDb);

            // Act
            const result = await Auth.getUserById(1, mockLogger);

            // Assert
            expect(result).toEqual(mockUserResult);
        });

        test("should return null when user not found", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValueOnce(null);

            // Act
            const result = await Auth.getUserById(999, mockLogger);

            // Assert
            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith("Auth: User not found by id", {
                userId: 999,
            });
        });

        test("should return null when database error occurs", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.users.findUnique.mockRejectedValueOnce(dbError);

            // Act
            const result = await Auth.getUserById(1, mockLogger);

            // Assert
            expect(result).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith("Auth: Error in getUserById", {
                userId: 1,
                error: dbError,
            });
        });
    });
});
