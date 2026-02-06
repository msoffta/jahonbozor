import { describe, test, expect, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { prismaMock, createMockLogger, expectSuccess, expectFailure } from "@test/setup";
import type { Users as UsersType } from "@generated/prisma/client";
import { Permission } from "@jahonbozor/schemas";
import { Users } from "../users.service";

// Mock user data
const mockUser: UsersType = {
    id: 1,
    fullname: "John Doe",
    username: "johndoe",
    phone: "+998901234567",
    photo: null,
    telegramId: "123456789",
    deletedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

const mockDeletedUser: UsersType = {
    ...mockUser,
    id: 2,
    deletedAt: new Date("2024-01-15"),
};

// Mock staff token for authorization
const mockStaffToken = {
    id: 10,
    type: "staff" as const,
    fullname: "Admin User",
    username: "admin",
    telegramId: "staff123456",
    roleId: 1,
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

// Create test app with mocked middleware
const createTestApp = () => {
    const mockLogger = createMockLogger();

    return new Elysia()
        .derive(() => ({
            user: mockStaffToken,
            permissions: [
                Permission.USERS_LIST,
                Permission.USERS_READ_ALL,
                Permission.USERS_CREATE,
                Permission.USERS_UPDATE_ALL,
                Permission.USERS_DELETE,
            ],
            logger: mockLogger,
            requestId: "test-request-id",
        }))
        .get("/users", async ({ query, logger }) => {
            return await Users.getAllUsers(
                {
                    page: Number(query.page) || 1,
                    limit: Number(query.limit) || 20,
                    searchQuery: query.searchQuery as string | undefined,
                    includeOrders: query.includeOrders === "true",
                    includeDeleted: query.includeDeleted === "true",
                },
                logger,
            );
        })
        .get("/users/:id", async ({ params, set, logger }) => {
            const result = await Users.getUser(Number(params.id), logger);
            if (!result.success) set.status = 404;
            return result;
        })
        .post("/users", async ({ body, logger, requestId }) => {
            return await Users.createUser(
                body as { fullname: string; username: string; phone: string; photo: string | null; telegramId: string | null },
                { staffId: mockStaffToken.id, user: mockStaffToken, requestId },
                logger,
            );
        })
        .put("/users/:id", async ({ params, body, set, logger, requestId }) => {
            const result = await Users.updateUser(
                Number(params.id),
                body as { fullname?: string; username?: string; phone?: string },
                { staffId: mockStaffToken.id, user: mockStaffToken, requestId },
                logger,
            );
            if (!result.success) {
                set.status = result.error === "User not found" ? 404 : 400;
            }
            return result;
        })
        .delete("/users/:id", async ({ params, set, logger, requestId }) => {
            const result = await Users.deleteUser(
                Number(params.id),
                { staffId: mockStaffToken.id, user: mockStaffToken, requestId },
                logger,
            );
            if (!result.success) {
                set.status = result.error === "User not found" ? 404 : 400;
            }
            return result;
        })
        .post("/users/:id/restore", async ({ params, set, logger, requestId }) => {
            const result = await Users.restoreUser(
                Number(params.id),
                { staffId: mockStaffToken.id, user: mockStaffToken, requestId },
                logger,
            );
            if (!result.success) {
                set.status = result.error === "User not found" ? 404 : 400;
            }
            return result;
        });
};

describe("Users API Endpoints", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    describe("GET /users", () => {
        test("should return paginated users list", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([1, [mockUser]]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/users?page=1&limit=20"),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            const success = expectSuccess(body);
            expect(success.data?.count).toBe(1);
            expect(success.data?.users).toHaveLength(1);
        });

        test("should filter by searchQuery", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([1, [mockUser]]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/users?searchQuery=John"),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
        });

        test("should include deleted users when includeDeleted=true", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([2, [mockUser, mockDeletedUser]]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/users?includeDeleted=true"),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.data?.users).toHaveLength(2);
        });
    });

    describe("GET /users/:id", () => {
        test("should return user by id", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValue(mockUser);

            // Act
            const response = await app.handle(
                new Request("http://localhost/users/1"),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            const success = expectSuccess(body);
            expect(success.data?.id).toBe(1);
        });

        test("should return 404 when user not found", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValue(null);

            // Act
            const response = await app.handle(
                new Request("http://localhost/users/999"),
            );

            // Assert
            expect(response.status).toBe(404);
            const body = await response.json();
            const failure = expectFailure(body);
            expect(failure.error).toBe("User not found");
        });
    });

    describe("POST /users", () => {
        test("should create new user", async () => {
            // Arrange
            const newUserData = {
                fullname: "Jane Doe",
                username: "janedoe",
                phone: "+998901234568",
                photo: null,
                telegramId: null,
            };
            const createdUser = { id: 2, ...newUserData, createdAt: new Date(), updatedAt: new Date(), deletedAt: null };

            mockTransaction({
                users: { create: () => Promise.resolve(createdUser) },
                auditLog: { create: () => Promise.resolve({}) },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newUserData),
                }),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            const success = expectSuccess(body);
            expect(success.data?.fullname).toBe("Jane Doe");
        });
    });

    describe("PUT /users/:id", () => {
        test("should update existing user", async () => {
            // Arrange
            const updatedUser = { ...mockUser, fullname: "John Updated" };
            prismaMock.users.findUnique.mockResolvedValue(mockUser);

            mockTransaction({
                users: { update: () => Promise.resolve(updatedUser) },
                auditLog: { create: () => Promise.resolve({}) },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/users/1", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fullname: "John Updated" }),
                }),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            const success = expectSuccess(body);
            expect(success.data?.fullname).toBe("John Updated");
        });

        test("should return 404 when user not found", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValue(null);

            // Act
            const response = await app.handle(
                new Request("http://localhost/users/999", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fullname: "Test" }),
                }),
            );

            // Assert
            expect(response.status).toBe(404);
            const body = await response.json();
            expect(body.error).toBe("User not found");
        });

        test("should return 400 when trying to update deleted user", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValue(mockDeletedUser);

            // Act
            const response = await app.handle(
                new Request("http://localhost/users/2", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fullname: "Test" }),
                }),
            );

            // Assert
            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error).toBe("Cannot update deleted user");
        });
    });

    describe("DELETE /users/:id", () => {
        test("should soft delete user", async () => {
            // Arrange
            const deletedUser = { ...mockUser, deletedAt: new Date() };
            prismaMock.users.findUnique.mockResolvedValue(mockUser);

            mockTransaction({
                users: { update: () => Promise.resolve(deletedUser) },
                auditLog: { create: () => Promise.resolve({}) },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/users/1", { method: "DELETE" }),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            const success = expectSuccess(body);
            expect(success.data?.deletedAt).not.toBeNull();
        });

        test("should return 404 when user not found", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValue(null);

            // Act
            const response = await app.handle(
                new Request("http://localhost/users/999", { method: "DELETE" }),
            );

            // Assert
            expect(response.status).toBe(404);
            const body = await response.json();
            expect(body.error).toBe("User not found");
        });

        test("should return 400 when user already deleted", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValue(mockDeletedUser);

            // Act
            const response = await app.handle(
                new Request("http://localhost/users/2", { method: "DELETE" }),
            );

            // Assert
            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error).toBe("User already deleted");
        });
    });

    describe("POST /users/:id/restore", () => {
        test("should restore deleted user", async () => {
            // Arrange
            const restoredUser = { ...mockDeletedUser, deletedAt: null };
            prismaMock.users.findUnique.mockResolvedValue(mockDeletedUser);

            mockTransaction({
                users: { update: () => Promise.resolve(restoredUser) },
                auditLog: { create: () => Promise.resolve({}) },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/users/2/restore", { method: "POST" }),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            const success = expectSuccess(body);
            expect(success.data?.deletedAt).toBeNull();
        });

        test("should return 404 when user not found", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValue(null);

            // Act
            const response = await app.handle(
                new Request("http://localhost/users/999/restore", { method: "POST" }),
            );

            // Assert
            expect(response.status).toBe(404);
            const body = await response.json();
            expect(body.error).toBe("User not found");
        });

        test("should return 400 when user is not deleted", async () => {
            // Arrange
            prismaMock.users.findUnique.mockResolvedValue(mockUser);

            // Act
            const response = await app.handle(
                new Request("http://localhost/users/1/restore", { method: "POST" }),
            );

            // Assert
            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error).toBe("User is not deleted");
        });
    });
});
