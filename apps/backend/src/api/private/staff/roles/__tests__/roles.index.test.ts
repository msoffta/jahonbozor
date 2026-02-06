import { describe, test, expect, beforeEach, spyOn } from "bun:test";
import { Elysia } from "elysia";
import { prismaMock, createMockLogger } from "@test/setup";
import type { Role } from "@generated/prisma/client";
import { Permission } from "@jahonbozor/schemas";
import { RolesService } from "../roles.service";

// Mock role data
const mockRole: Role = {
    id: 1,
    name: "Admin",
    permissions: [Permission.USERS_CREATE, Permission.USERS_READ_ALL],
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

const mockRoleWithCount = {
    ...mockRole,
    _count: { staffs: 5 },
};

// Create test app with mocked middleware
const createTestApp = () => {
    const mockLogger = createMockLogger();

    return new Elysia()
        .derive(() => ({
            user: {
                id: 1,
                type: "staff" as const,
                fullname: "Test Admin",
                username: "testadmin",
                telegramId: "123456789",
                roleId: 1,
            },
            permissions: [
                Permission.ROLES_LIST,
                Permission.ROLES_READ,
                Permission.ROLES_CREATE,
                Permission.ROLES_UPDATE,
                Permission.ROLES_DELETE,
            ],
            logger: mockLogger,
            requestId: "test-request-id",
        }))
        .get("/roles", async ({ query, logger }) => {
            return await RolesService.getAllRoles(
                {
                    page: Number(query.page) || 1,
                    limit: Number(query.limit) || 20,
                    searchQuery: query.searchQuery,
                    includeStaffCount: query.includeStaffCount === "true",
                },
                logger,
            );
        })
        .get("/roles/:id", async ({ params, query, logger }) => {
            return await RolesService.getRole(
                Number(params.id),
                query.includeStaffCount === "true",
                logger,
            );
        });
};

describe("Roles API Routes", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    describe("GET /roles", () => {
        test("should return paginated roles list", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([1, [mockRole]]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/roles?page=1&limit=20"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(1);
            expect(body.data.roles).toHaveLength(1);
        });

        test("should apply search query filter", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([1, [mockRole]]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/roles?searchQuery=Admin"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
        });

        test("should include staff count when requested", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([1, [mockRoleWithCount]]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/roles?includeStaffCount=true"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.roles[0]._count).toBeDefined();
            expect(body.data.roles[0]._count.staffs).toBe(5);
        });

        test("should return empty list when no roles found", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([0, []]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/roles"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(0);
            expect(body.data.roles).toHaveLength(0);
        });
    });

    describe("GET /roles/:id", () => {
        test("should return role by id", async () => {
            // Arrange
            prismaMock.role.findUnique.mockResolvedValueOnce(mockRole);

            // Act
            const response = await app.handle(
                new Request("http://localhost/roles/1"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.id).toBe(1);
            expect(body.data.name).toBe("Admin");
        });

        test("should include staff count when requested", async () => {
            // Arrange
            prismaMock.role.findUnique.mockResolvedValueOnce(mockRoleWithCount as unknown as Role);

            // Act
            const response = await app.handle(
                new Request("http://localhost/roles/1?includeStaffCount=true"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data._count).toBeDefined();
        });

        test("should return error when role not found", async () => {
            // Arrange
            prismaMock.role.findUnique.mockResolvedValueOnce(null);

            // Act
            const response = await app.handle(
                new Request("http://localhost/roles/999"),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Role not found");
        });
    });
});

describe("Roles Service Integration", () => {
    test("getAllRoles should be called with correct pagination", async () => {
        // Arrange
        const spy = spyOn(RolesService, "getAllRoles").mockResolvedValue({
            success: true,
            data: { count: 0, roles: [] },
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/roles?page=3&limit=15"));

        // Assert
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ page: 3, limit: 15 }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("getRole should be called with correct id and includeStaffCount", async () => {
        // Arrange
        const spy = spyOn(RolesService, "getRole").mockResolvedValue({
            success: true,
            data: mockRole,
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/roles/5?includeStaffCount=true"));

        // Assert
        expect(spy).toHaveBeenCalledWith(5, true, expect.anything());

        spy.mockRestore();
    });

    test("getRole should pass false for includeStaffCount when not specified", async () => {
        // Arrange
        const spy = spyOn(RolesService, "getRole").mockResolvedValue({
            success: true,
            data: mockRole,
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/roles/1"));

        // Assert
        expect(spy).toHaveBeenCalledWith(1, false, expect.anything());

        spy.mockRestore();
    });
});
