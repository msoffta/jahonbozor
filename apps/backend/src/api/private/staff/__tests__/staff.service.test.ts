import { describe, test, expect, beforeEach } from "bun:test";
import { prismaMock, createMockLogger, expectSuccess, expectFailure } from "@test/setup";
import type { Staff, Role, AuditLog } from "@generated/prisma/client";
import { type Token, Permission } from "@jahonbozor/schemas";
import { StaffService } from "../staff.service";

const mockRole: Role = {
    id: 1,
    name: "Admin",
    permissions: [Permission.STAFF_CREATE, Permission.STAFF_READ_ALL, Permission.STAFF_UPDATE_ALL],
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

const mockStaff: Staff = {
    id: 1,
    fullname: "John Doe",
    username: "johndoe",
    passwordHash: "$argon2id$...",
    telegramId: BigInt(123456789),
    roleId: 1,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

const mockStaffWithRole = {
    id: 1,
    fullname: "John Doe",
    username: "johndoe",
    telegramId: BigInt(123456789),
    roleId: 1,
    role: {
        id: 1,
        name: "Admin",
        permissions: mockRole.permissions,
    },
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

const mockTokenStaff: Token = {
    id: 1,
    type: "staff" as const,
    fullname: "Test Admin",
    username: "testadmin",
    telegramId: "123456789",
    roleId: 1,
};

const mockContext = {
    staffId: 1,
    user: mockTokenStaff,
    requestId: "req-123",
};

describe("Staff Service", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeEach(() => {
        mockLogger = createMockLogger();
    });

    describe("getAllStaff", () => {
        test("should return paginated staff list", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([3, [mockStaffWithRole]]);

            // Act
            const result = await StaffService.getAllStaff(
                { page: 1, limit: 20 },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ count: 3, staff: [mockStaffWithRole] });
        });

        test("should apply searchQuery filter", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([1, [mockStaffWithRole]]);

            // Act
            const result = await StaffService.getAllStaff(
                { page: 1, limit: 20, searchQuery: "John" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.staff).toHaveLength(1);
        });

        test("should apply roleId filter", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([1, [mockStaffWithRole]]);

            // Act
            const result = await StaffService.getAllStaff(
                { page: 1, limit: 20, roleId: 1 },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.staff).toHaveLength(1);
        });

        test("should return empty array when no staff found", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([0, []]);

            // Act
            const result = await StaffService.getAllStaff(
                { page: 1, limit: 20, searchQuery: "nonexistent" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ count: 0, staff: [] });
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database connection failed");
            prismaMock.$transaction.mockRejectedValue(dbError);

            // Act
            const result = await StaffService.getAllStaff(
                { page: 1, limit: 20 },
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("getStaff", () => {
        test("should return staff by id", async () => {
            // Arrange
            prismaMock.staff.findUnique.mockResolvedValueOnce(mockStaffWithRole as unknown as Staff);

            // Act
            const result = await StaffService.getStaff(1, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual(mockStaffWithRole);
            expect(prismaMock.staff.findUnique).toHaveBeenCalled();
        });

        test("should return error when staff not found", async () => {
            // Arrange
            prismaMock.staff.findUnique.mockResolvedValueOnce(null);

            // Act
            const result = await StaffService.getStaff(999, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Staff not found");
            expect(mockLogger.warn).toHaveBeenCalledWith("Staff: Staff not found", { staffId: 999 });
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.staff.findUnique.mockRejectedValueOnce(dbError);

            // Act
            const result = await StaffService.getStaff(1, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("createStaff", () => {
        const validStaffData = {
            fullname: "New Staff",
            username: "newstaff",
            password: "password123",
            telegramId: "987654321",
            roleId: 1,
        };

        test("should create staff with valid data", async () => {
            // Arrange
            const createdStaff = {
                ...mockStaffWithRole,
                id: 2,
                fullname: validStaffData.fullname,
                username: validStaffData.username,
            };
            prismaMock.staff.findFirst.mockResolvedValueOnce(null);
            prismaMock.staff.create.mockResolvedValueOnce(createdStaff as unknown as Staff);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await StaffService.createStaff(validStaffData, mockContext, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.username).toBe("newstaff");
            expect(mockLogger.info).toHaveBeenCalledWith("Staff: Staff created", {
                staffId: 2,
                username: "newstaff",
                createdBy: 1,
            });
        });

        test("should return error when username already exists", async () => {
            // Arrange
            prismaMock.staff.findFirst.mockResolvedValueOnce(mockStaff);

            // Act
            const result = await StaffService.createStaff(
                { ...validStaffData, username: "johndoe" },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Username already exists");
            expect(mockLogger.warn).toHaveBeenCalledWith("Staff: Username already exists", {
                username: "johndoe",
            });
        });

        test("should handle database error during creation", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.staff.findFirst.mockResolvedValueOnce(null);
            prismaMock.$transaction.mockRejectedValueOnce(dbError);

            // Act
            const result = await StaffService.createStaff(validStaffData, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("updateStaff", () => {
        test("should update staff with valid data", async () => {
            // Arrange
            const updatedStaff = { ...mockStaffWithRole, fullname: "Updated Name" };
            prismaMock.staff.findUnique.mockResolvedValueOnce(mockStaff);
            prismaMock.staff.update.mockResolvedValueOnce(updatedStaff as unknown as Staff);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await StaffService.updateStaff(
                1,
                { fullname: "Updated Name" },
                mockContext,
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.fullname).toBe("Updated Name");
            expect(mockLogger.info).toHaveBeenCalledWith("Staff: Staff updated", {
                staffId: 1,
                passwordChanged: false,
                updatedBy: 1,
            });
        });

        test("should return error when staff not found", async () => {
            // Arrange
            prismaMock.staff.findUnique.mockResolvedValueOnce(null);

            // Act
            const result = await StaffService.updateStaff(
                999,
                { fullname: "New Name" },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Staff not found");
            expect(mockLogger.warn).toHaveBeenCalledWith("Staff: Staff not found for update", {
                staffId: 999,
            });
        });

        test("should return error when new username already exists", async () => {
            // Arrange
            const existingStaff: Staff = {
                ...mockStaff,
                id: 2,
                username: "existing",
            };
            prismaMock.staff.findUnique.mockResolvedValueOnce(mockStaff);
            prismaMock.staff.findFirst.mockResolvedValueOnce(existingStaff);

            // Act
            const result = await StaffService.updateStaff(
                1,
                { username: "existing" },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Username already exists");
            expect(mockLogger.warn).toHaveBeenCalledWith("Staff: Username already exists", {
                staffId: 1,
                username: "existing",
            });
        });

        test("should detect password change and use PASSWORD_CHANGE action", async () => {
            // Arrange
            const updatedStaff = { ...mockStaffWithRole };
            prismaMock.staff.findUnique.mockResolvedValueOnce(mockStaff);
            prismaMock.staff.update.mockResolvedValueOnce(updatedStaff as unknown as Staff);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await StaffService.updateStaff(
                1,
                { password: "newpassword123" },
                mockContext,
                mockLogger,
            );

            // Assert
            expectSuccess(result);
            expect(mockLogger.info).toHaveBeenCalledWith("Staff: Staff updated", {
                staffId: 1,
                passwordChanged: true,
                updatedBy: 1,
            });
        });

        test("should allow partial update", async () => {
            // Arrange
            const updatedStaff = { ...mockStaffWithRole, roleId: 2 };
            prismaMock.staff.findUnique.mockResolvedValueOnce(mockStaff);
            prismaMock.staff.update.mockResolvedValueOnce(updatedStaff as unknown as Staff);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await StaffService.updateStaff(
                1,
                { roleId: 2 },
                mockContext,
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.roleId).toBe(2);
        });

        test("should handle database error", async () => {
            // Arrange
            prismaMock.staff.findUnique.mockResolvedValueOnce(mockStaff);
            const dbError = new Error("Database error");
            prismaMock.$transaction.mockRejectedValueOnce(dbError);

            // Act
            const result = await StaffService.updateStaff(
                1,
                { fullname: "Updated" },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("deleteStaff", () => {
        test("should delete staff successfully", async () => {
            // Arrange
            const deletedStaff = {
                id: 1,
                fullname: "John Doe",
                username: "johndoe",
            };
            prismaMock.staff.findUnique.mockResolvedValueOnce(mockStaff);
            prismaMock.refreshToken.deleteMany.mockResolvedValueOnce({ count: 2 });
            prismaMock.staff.delete.mockResolvedValueOnce(deletedStaff as unknown as Staff);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await StaffService.deleteStaff(1, mockContext, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual(deletedStaff);
            expect(mockLogger.info).toHaveBeenCalledWith("Staff: Staff deleted", {
                staffId: 1,
                username: "johndoe",
                deletedBy: 1,
            });
        });

        test("should return error when staff not found", async () => {
            // Arrange
            prismaMock.staff.findUnique.mockResolvedValueOnce(null);

            // Act
            const result = await StaffService.deleteStaff(999, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Staff not found");
            expect(mockLogger.warn).toHaveBeenCalledWith("Staff: Staff not found for delete", {
                staffId: 999,
            });
        });

        test("should delete refresh tokens before deleting staff", async () => {
            // Arrange
            const deletedStaff = {
                id: 1,
                fullname: "John Doe",
                username: "johndoe",
            };
            prismaMock.staff.findUnique.mockResolvedValueOnce(mockStaff);
            prismaMock.refreshToken.deleteMany.mockResolvedValueOnce({ count: 5 });
            prismaMock.staff.delete.mockResolvedValueOnce(deletedStaff as unknown as Staff);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await StaffService.deleteStaff(1, mockContext, mockLogger);

            // Assert
            expectSuccess(result);
            expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalled();
        });

        test("should handle database error", async () => {
            // Arrange
            prismaMock.staff.findUnique.mockResolvedValueOnce(mockStaff);
            const dbError = new Error("Database error");
            prismaMock.$transaction.mockRejectedValueOnce(dbError);

            // Act
            const result = await StaffService.deleteStaff(1, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });
});
