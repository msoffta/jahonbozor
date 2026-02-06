import { describe, test, expect, beforeEach, spyOn } from "bun:test";
import { Elysia } from "elysia";
import { prismaMock, createMockLogger } from "@test/setup";
import type { Staff } from "@generated/prisma/client";
import { Permission } from "@jahonbozor/schemas";
import { StaffService } from "../staff.service";

// Mock staff data (telegramId as string for JSON serialization)
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
    telegramId: "123456789",
    roleId: 1,
    role: {
        id: 1,
        name: "Admin",
        permissions: [Permission.STAFF_LIST, Permission.STAFF_READ_ALL, Permission.STAFF_CREATE],
    },
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

// Mock user for tests
const mockUser = {
    id: 1,
    type: "staff" as const,
    fullname: "Test Admin",
    username: "testadmin",
    telegramId: "123456789",
    roleId: 1,
};

// Create test app with mocked middleware
const createTestApp = () => {
    const mockLogger = createMockLogger();

    return new Elysia()
        .derive(() => ({
            user: mockUser,
            permissions: [
                Permission.STAFF_LIST,
                Permission.STAFF_READ_ALL,
                Permission.STAFF_READ_OWN,
                Permission.STAFF_CREATE,
                Permission.STAFF_UPDATE_ALL,
                Permission.STAFF_UPDATE_OWN,
                Permission.STAFF_DELETE,
            ],
            logger: mockLogger,
            requestId: "test-request-id",
        }))
        .get("/staff", async ({ query, logger }) => {
            return await StaffService.getAllStaff(
                {
                    page: Number(query.page) || 1,
                    limit: Number(query.limit) || 20,
                    searchQuery: query.searchQuery,
                    roleId: query.roleId ? Number(query.roleId) : undefined,
                },
                logger,
            );
        })
        .get("/staff/:id", async ({ params, logger }) => {
            return await StaffService.getStaff(Number(params.id), logger);
        })
        .post("/staff", async ({ body, logger, requestId }) => {
            return await StaffService.createStaff(
                body as { fullname: string; username: string; password: string; telegramId: string; roleId: number },
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        })
        .patch("/staff/:id", async ({ params, body, logger, requestId }) => {
            return await StaffService.updateStaff(
                Number(params.id),
                body as { fullname?: string; username?: string; password?: string; roleId?: number },
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        })
        .delete("/staff/:id", async ({ params, logger, requestId }) => {
            return await StaffService.deleteStaff(
                Number(params.id),
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        });
};

describe("Staff API Routes", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    describe("GET /staff", () => {
        test("should return paginated staff list", async () => {
            // Arrange
            const spy = spyOn(StaffService, "getAllStaff").mockResolvedValue({
                success: true,
                data: { count: 2, staff: [mockStaffWithRole] },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/staff?page=1&limit=20"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(2);
            expect(body.data.staff).toHaveLength(1);

            spy.mockRestore();
        });

        test("should apply searchQuery filter", async () => {
            // Arrange
            const spy = spyOn(StaffService, "getAllStaff").mockResolvedValue({
                success: true,
                data: { count: 1, staff: [mockStaffWithRole] },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/staff?searchQuery=John"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ searchQuery: "John" }),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should apply roleId filter", async () => {
            // Arrange
            const spy = spyOn(StaffService, "getAllStaff").mockResolvedValue({
                success: true,
                data: { count: 1, staff: [mockStaffWithRole] },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/staff?roleId=1"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ roleId: 1 }),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should return empty list when no staff found", async () => {
            // Arrange
            const spy = spyOn(StaffService, "getAllStaff").mockResolvedValue({
                success: true,
                data: { count: 0, staff: [] },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/staff"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(0);
            expect(body.data.staff).toHaveLength(0);

            spy.mockRestore();
        });
    });

    describe("GET /staff/:id", () => {
        test("should return staff by id", async () => {
            // Arrange
            const spy = spyOn(StaffService, "getStaff").mockResolvedValue({
                success: true,
                data: mockStaffWithRole,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/staff/1"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.id).toBe(1);
            expect(body.data.username).toBe("johndoe");

            spy.mockRestore();
        });

        test("should return error when staff not found", async () => {
            // Arrange
            const spy = spyOn(StaffService, "getStaff").mockResolvedValue({
                success: false,
                error: "Staff not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/staff/999"),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Staff not found");

            spy.mockRestore();
        });
    });

    describe("POST /staff", () => {
        test("should create staff with valid data", async () => {
            // Arrange
            const spy = spyOn(StaffService, "createStaff").mockResolvedValue({
                success: true,
                data: mockStaffWithRole,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/staff", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        fullname: "John Doe",
                        username: "johndoe",
                        password: "password123",
                        telegramId: "123456789",
                        roleId: 1,
                    }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.username).toBe("johndoe");

            spy.mockRestore();
        });

        test("should return error when username already exists", async () => {
            // Arrange
            const spy = spyOn(StaffService, "createStaff").mockResolvedValue({
                success: false,
                error: "Username already exists",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/staff", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        fullname: "John Doe",
                        username: "johndoe",
                        password: "password123",
                        telegramId: "123456789",
                        roleId: 1,
                    }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Username already exists");

            spy.mockRestore();
        });
    });

    describe("PATCH /staff/:id", () => {
        test("should update staff fullname", async () => {
            // Arrange
            const updatedStaff = { ...mockStaffWithRole, fullname: "Jane Doe" };
            const spy = spyOn(StaffService, "updateStaff").mockResolvedValue({
                success: true,
                data: updatedStaff,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/staff/1", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fullname: "Jane Doe" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.fullname).toBe("Jane Doe");

            spy.mockRestore();
        });

        test("should return error when staff not found", async () => {
            // Arrange
            const spy = spyOn(StaffService, "updateStaff").mockResolvedValue({
                success: false,
                error: "Staff not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/staff/999", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fullname: "New Name" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Staff not found");

            spy.mockRestore();
        });

        test("should return error when new username already exists", async () => {
            // Arrange
            const spy = spyOn(StaffService, "updateStaff").mockResolvedValue({
                success: false,
                error: "Username already exists",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/staff/1", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: "existinguser" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Username already exists");

            spy.mockRestore();
        });
    });

    describe("DELETE /staff/:id", () => {
        test("should delete staff successfully", async () => {
            // Arrange
            const deletedStaff = { id: 1, fullname: "John Doe", username: "johndoe" };
            const spy = spyOn(StaffService, "deleteStaff").mockResolvedValue({
                success: true,
                data: deletedStaff,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/staff/1", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.username).toBe("johndoe");

            spy.mockRestore();
        });

        test("should return error when staff not found", async () => {
            // Arrange
            const spy = spyOn(StaffService, "deleteStaff").mockResolvedValue({
                success: false,
                error: "Staff not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/staff/999", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Staff not found");

            spy.mockRestore();
        });
    });
});

describe("Staff Service Integration", () => {
    test("getAllStaff should be called with correct pagination", async () => {
        // Arrange
        const spy = spyOn(StaffService, "getAllStaff").mockResolvedValue({
            success: true,
            data: { count: 0, staff: [] },
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/staff?page=3&limit=15"));

        // Assert
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ page: 3, limit: 15 }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("getStaff should be called with correct id", async () => {
        // Arrange
        const spy = spyOn(StaffService, "getStaff").mockResolvedValue({
            success: true,
            data: mockStaffWithRole,
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/staff/42"));

        // Assert
        expect(spy).toHaveBeenCalledWith(42, expect.anything());

        spy.mockRestore();
    });

    test("createStaff should be called with context", async () => {
        // Arrange
        const spy = spyOn(StaffService, "createStaff").mockResolvedValue({
            success: true,
            data: mockStaffWithRole,
        });
        const app = createTestApp();

        // Act
        await app.handle(
            new Request("http://localhost/staff", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullname: "Test",
                    username: "test",
                    password: "pass",
                    telegramId: "123",
                    roleId: 1,
                }),
            }),
        );

        // Assert
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ fullname: "Test", username: "test" }),
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("updateStaff should be called with context", async () => {
        // Arrange
        const spy = spyOn(StaffService, "updateStaff").mockResolvedValue({
            success: true,
            data: mockStaffWithRole,
        });
        const app = createTestApp();

        // Act
        await app.handle(
            new Request("http://localhost/staff/1", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fullname: "Updated" }),
            }),
        );

        // Assert
        expect(spy).toHaveBeenCalledWith(
            1,
            { fullname: "Updated" },
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("deleteStaff should be called with context", async () => {
        // Arrange
        const spy = spyOn(StaffService, "deleteStaff").mockResolvedValue({
            success: true,
            data: { id: 1, fullname: "John", username: "john" },
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/staff/1", { method: "DELETE" }));

        // Assert
        expect(spy).toHaveBeenCalledWith(
            1,
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.anything(),
        );

        spy.mockRestore();
    });
});
