import { describe, test, expect, beforeEach } from "bun:test";
import { prismaMock, createMockLogger, expectSuccess, expectFailure } from "@test/setup";
import type { Role, AuditLog } from "@generated/prisma/client";
import { type Token, Permission } from "@jahonbozor/schemas";
import { RolesService } from "../roles.service";

const mockRole: Role = {
    id: 1,
    name: "Admin",
    permissions: [Permission.USERS_CREATE, Permission.USERS_READ_ALL, Permission.USERS_UPDATE_ALL],
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

const mockRoleWithCount = {
    ...mockRole,
    _count: { staffs: 5 },
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

describe("Roles Service", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeEach(() => {
        mockLogger = createMockLogger();
        // setup.ts handles mockReset() globally
    });

    describe("getAllRoles", () => {
        test("should return paginated roles", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([3, [mockRole]]);

            // Act
            const result = await RolesService.getAllRoles(
                { page: 1, limit: 20 },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ count: 3, roles: [mockRole] });
        });

        test("should apply searchQuery filter", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([1, [mockRole]]);

            // Act
            const result = await RolesService.getAllRoles(
                { page: 1, limit: 20, searchQuery: "Admin" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.roles).toHaveLength(1);
        });

        test("should include staff count when requested", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([1, [mockRoleWithCount]]);

            // Act
            const result = await RolesService.getAllRoles(
                { page: 1, limit: 20, includeStaffCount: true },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.roles[0]._count).toBeDefined();
            expect(success.data?.roles[0]._count.staffs).toBe(5);
        });

        test("should return empty array when no roles found", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([0, []]);

            // Act
            const result = await RolesService.getAllRoles(
                { page: 1, limit: 20, searchQuery: "nonexistent" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ count: 0, roles: [] });
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database connection failed");
            prismaMock.$transaction.mockRejectedValue(dbError);

            // Act
            const result = await RolesService.getAllRoles(
                { page: 1, limit: 20 },
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("getRole", () => {
        test("should return role by id", async () => {
            // Arrange
            prismaMock.role.findUnique.mockResolvedValueOnce(mockRole);

            // Act
            const result = await RolesService.getRole(1, false, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual(mockRole);
            expect(prismaMock.role.findUnique).toHaveBeenCalledWith({
                where: { id: 1 },
                include: undefined,
            });
        });

        test("should include staff count when requested", async () => {
            // Arrange
            prismaMock.role.findUnique.mockResolvedValueOnce(mockRoleWithCount);

            // Act
            const result = await RolesService.getRole(1, true, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?._count).toBeDefined();
            expect(prismaMock.role.findUnique).toHaveBeenCalledWith({
                where: { id: 1 },
                include: { _count: { select: { staffs: true } } },
            });
        });

        test("should return error when role not found", async () => {
            // Arrange
            prismaMock.role.findUnique.mockResolvedValueOnce(null);

            // Act
            const result = await RolesService.getRole(999, false, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Role not found");
            expect(mockLogger.warn).toHaveBeenCalledWith("Roles: Role not found", { roleId: 999 });
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.role.findUnique.mockRejectedValueOnce(dbError);

            // Act
            const result = await RolesService.getRole(1, false, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("createRole", () => {
        const validRoleData = {
            name: "Manager",
            permissions: [Permission.PRODUCTS_READ, Permission.PRODUCTS_LIST],
        };

        test("should create role with valid data", async () => {
            // Arrange
            const createdRole = {
                id: 2,
                ...validRoleData,
                createdAt: new Date("2024-01-01"),
                updatedAt: new Date("2024-01-01"),
            };
            prismaMock.role.findFirst.mockResolvedValueOnce(null);
            prismaMock.role.create.mockResolvedValueOnce(createdRole);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await RolesService.createRole(validRoleData, mockContext, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.name).toBe("Manager");
            expect(mockLogger.info).toHaveBeenCalledWith("Roles: Role created", {
                roleId: 2,
                name: "Manager",
                staffId: 1,
            });
        });

        test("should return error when role name already exists", async () => {
            // Arrange
            prismaMock.role.findFirst.mockResolvedValueOnce(mockRole);

            // Act
            const result = await RolesService.createRole(
                { name: "Admin", permissions: [] as Permission[] },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Role name already exists");
            expect(mockLogger.warn).toHaveBeenCalledWith("Roles: Role name already exists", {
                name: "Admin",
            });
        });

        test("should create role with empty permissions", async () => {
            // Arrange
            const roleWithNoPerms = { name: "NoPerms", permissions: [] as Permission[] };
            const createdRole = {
                id: 3,
                ...roleWithNoPerms,
                createdAt: new Date("2024-01-01"),
                updatedAt: new Date("2024-01-01"),
            };
            prismaMock.role.findFirst.mockResolvedValueOnce(null);
            prismaMock.role.create.mockResolvedValueOnce(createdRole);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await RolesService.createRole(roleWithNoPerms, mockContext, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.permissions).toEqual([]);
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.role.findFirst.mockResolvedValueOnce(null);
            prismaMock.$transaction.mockRejectedValueOnce(dbError);

            // Act
            const result = await RolesService.createRole(validRoleData, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("updateRole", () => {
        test("should update role with valid data", async () => {
            // Arrange
            const updatedRole = { ...mockRole, name: "Super Admin" };
            prismaMock.role.findUnique.mockResolvedValueOnce(mockRole);
            prismaMock.role.findFirst.mockResolvedValueOnce(null);
            prismaMock.role.update.mockResolvedValueOnce(updatedRole);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await RolesService.updateRole(
                1,
                { name: "Super Admin" },
                mockContext,
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.name).toBe("Super Admin");
            expect(mockLogger.info).toHaveBeenCalledWith("Roles: Role updated", {
                roleId: 1,
                permissionsChanged: false,
                staffId: 1,
            });
        });

        test("should return error when role not found", async () => {
            // Arrange
            prismaMock.role.findUnique.mockResolvedValueOnce(null);

            // Act
            const result = await RolesService.updateRole(
                999,
                { name: "New Name" },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Role not found");
            expect(mockLogger.warn).toHaveBeenCalledWith("Roles: Role not found for update", {
                roleId: 999,
            });
        });

        test("should return error when new name already exists", async () => {
            // Arrange
            const existingRole: Role = {
                id: 2,
                name: "Existing",
                permissions: [],
                createdAt: new Date("2024-01-01"),
                updatedAt: new Date("2024-01-01"),
            };
            prismaMock.role.findUnique.mockResolvedValueOnce(mockRole);
            prismaMock.role.findFirst.mockResolvedValueOnce(existingRole);

            // Act
            const result = await RolesService.updateRole(
                1,
                { name: "Existing" },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Role name already exists");
            expect(mockLogger.warn).toHaveBeenCalledWith("Roles: Role name already exists", {
                roleId: 1,
                name: "Existing",
            });
        });

        test("should detect permission change and use PERMISSION_CHANGE action", async () => {
            // Arrange
            const updatedRole = { ...mockRole, permissions: [Permission.STAFF_CREATE] };
            prismaMock.role.findUnique.mockResolvedValueOnce(mockRole);
            prismaMock.role.update.mockResolvedValueOnce(updatedRole);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await RolesService.updateRole(
                1,
                { permissions: [Permission.STAFF_CREATE] },
                mockContext,
                mockLogger,
            );

            // Assert
            expectSuccess(result);
            expect(mockLogger.info).toHaveBeenCalledWith("Roles: Role updated", {
                roleId: 1,
                permissionsChanged: true,
                staffId: 1,
            });
        });

        test("should allow update without changing name", async () => {
            // Arrange
            const updatedRole = { ...mockRole, permissions: [Permission.ORDERS_LIST_ALL] };
            prismaMock.role.findUnique.mockResolvedValueOnce(mockRole);
            prismaMock.role.update.mockResolvedValueOnce(updatedRole);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await RolesService.updateRole(
                1,
                { permissions: [Permission.ORDERS_LIST_ALL] },
                mockContext,
                mockLogger,
            );

            // Assert
            expectSuccess(result);
            expect(prismaMock.role.findFirst).not.toHaveBeenCalled();
        });

        test("should handle database error", async () => {
            // Arrange
            prismaMock.role.findUnique.mockResolvedValueOnce(mockRole);
            prismaMock.role.findFirst.mockResolvedValueOnce(null);
            const dbError = new Error("Database error");
            prismaMock.$transaction.mockRejectedValueOnce(dbError);

            // Act
            const result = await RolesService.updateRole(
                1,
                { name: "Updated" },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("deleteRole", () => {
        test("should delete role when no staff assigned", async () => {
            // Arrange
            prismaMock.role.findUnique.mockResolvedValueOnce(mockRole);
            prismaMock.staff.count.mockResolvedValueOnce(0);
            prismaMock.role.delete.mockResolvedValueOnce(mockRole);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await RolesService.deleteRole(1, mockContext, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual(mockRole);
            expect(mockLogger.info).toHaveBeenCalledWith("Roles: Role deleted", {
                roleId: 1,
                name: "Admin",
                staffId: 1,
            });
        });

        test("should return error when role not found", async () => {
            // Arrange
            prismaMock.role.findUnique.mockResolvedValueOnce(null);

            // Act
            const result = await RolesService.deleteRole(999, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Role not found");
            expect(mockLogger.warn).toHaveBeenCalledWith("Roles: Role not found for delete", {
                roleId: 999,
            });
        });

        test("should return error when staff are assigned to role", async () => {
            // Arrange
            prismaMock.role.findUnique.mockResolvedValueOnce(mockRole);
            prismaMock.staff.count.mockResolvedValueOnce(5);

            // Act
            const result = await RolesService.deleteRole(1, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Cannot delete role with 5 assigned staff member(s)");
            expect(mockLogger.warn).toHaveBeenCalledWith("Roles: Cannot delete role with assigned staff", {
                roleId: 1,
                staffCount: 5,
            });
        });

        test("should return error when single staff is assigned", async () => {
            // Arrange
            prismaMock.role.findUnique.mockResolvedValueOnce(mockRole);
            prismaMock.staff.count.mockResolvedValueOnce(1);

            // Act
            const result = await RolesService.deleteRole(1, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Cannot delete role with 1 assigned staff member(s)");
        });

        test("should handle database error", async () => {
            // Arrange
            prismaMock.role.findUnique.mockResolvedValueOnce(mockRole);
            prismaMock.staff.count.mockResolvedValueOnce(0);
            const dbError = new Error("Database error");
            prismaMock.$transaction.mockRejectedValueOnce(dbError);

            // Act
            const result = await RolesService.deleteRole(1, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });
});
