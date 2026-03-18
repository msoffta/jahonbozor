import { Elysia } from "elysia";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { Permission } from "@jahonbozor/schemas";

import { createMockLogger } from "@backend/test/setup";

import { ExpensesService } from "../expenses.service";

// Mock expense data
const mockExpense = {
    id: 1,
    name: "Office Rent",
    amount: 5000,
    description: "Monthly rent payment",
    expenseDate: new Date("2024-06-01"),
    staffId: 1,
    deletedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    staff: {
        id: 1,
        fullname: "Test Admin",
    },
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
                Permission.EXPENSES_LIST,
                Permission.EXPENSES_READ,
                Permission.EXPENSES_CREATE,
                Permission.EXPENSES_UPDATE,
                Permission.EXPENSES_DELETE,
            ],
            logger: mockLogger,
            requestId: "test-request-id",
        }))
        .get("/expenses", async ({ query, logger }) => {
            return await ExpensesService.getAllExpenses(
                {
                    page: Number(query.page) || 1,
                    limit: Number(query.limit) || 20,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: query.searchQuery,
                    staffId: query.staffId ? Number(query.staffId) : undefined,
                    dateFrom: query.dateFrom || undefined,
                    dateTo: query.dateTo || undefined,
                    includeDeleted: query.includeDeleted === "true",
                },
                logger,
            );
        })
        .get("/expenses/:id", async ({ params, logger }) => {
            return await ExpensesService.getExpense(Number(params.id), logger);
        })
        .post("/expenses", async ({ body, logger, requestId }) => {
            const expenseData = body as {
                name: string;
                amount: number;
                description: string | null;
                expenseDate: string;
            };
            return await ExpensesService.createExpense(
                { ...expenseData, expenseDate: new Date(expenseData.expenseDate) },
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        })
        .patch("/expenses/:id", async ({ params, body, logger, requestId }) => {
            return await ExpensesService.updateExpense(
                Number(params.id),
                body as {
                    name?: string;
                    amount?: number;
                    description?: string | null;
                    expenseDate?: Date;
                },
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        })
        .delete("/expenses/:id", async ({ params, logger, requestId }) => {
            return await ExpensesService.deleteExpense(
                Number(params.id),
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        })
        .post("/expenses/:id/restore", async ({ params, logger, requestId }) => {
            return await ExpensesService.restoreExpense(
                Number(params.id),
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        });
};

describe("Expenses API Routes", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    describe("GET /expenses", () => {
        test("should return paginated expenses list", async () => {
            // Arrange
            const spy = vi.spyOn(ExpensesService, "getAllExpenses").mockResolvedValue({
                success: true,
                data: { count: 2, expenses: [mockExpense] },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/expenses?page=1&limit=20"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(2);

            spy.mockRestore();
        });

        test("should apply searchQuery filter", async () => {
            // Arrange
            const spy = vi.spyOn(ExpensesService, "getAllExpenses").mockResolvedValue({
                success: true,
                data: { count: 1, expenses: [mockExpense] },
            });

            // Act
            await app.handle(new Request("http://localhost/expenses?searchQuery=Rent"));

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ searchQuery: "Rent" }),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should apply staffId filter", async () => {
            // Arrange
            const spy = vi.spyOn(ExpensesService, "getAllExpenses").mockResolvedValue({
                success: true,
                data: { count: 1, expenses: [mockExpense] },
            });

            // Act
            await app.handle(new Request("http://localhost/expenses?staffId=2"));

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ staffId: 2 }),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should apply date range filter", async () => {
            // Arrange
            const spy = vi.spyOn(ExpensesService, "getAllExpenses").mockResolvedValue({
                success: true,
                data: { count: 0, expenses: [] },
            });

            // Act
            await app.handle(
                new Request("http://localhost/expenses?dateFrom=2024-01-01&dateTo=2024-12-31"),
            );

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ dateFrom: "2024-01-01", dateTo: "2024-12-31" }),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should include deleted expenses when requested", async () => {
            // Arrange
            const spy = vi.spyOn(ExpensesService, "getAllExpenses").mockResolvedValue({
                success: true,
                data: { count: 1, expenses: [{ ...mockExpense, deletedAt: new Date() }] },
            });

            // Act
            await app.handle(new Request("http://localhost/expenses?includeDeleted=true"));

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ includeDeleted: true }),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should return empty list when no expenses exist", async () => {
            // Arrange
            const spy = vi.spyOn(ExpensesService, "getAllExpenses").mockResolvedValue({
                success: true,
                data: { count: 0, expenses: [] },
            });

            // Act
            const response = await app.handle(new Request("http://localhost/expenses"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(0);
            expect(body.data.expenses).toEqual([]);

            spy.mockRestore();
        });
    });

    describe("GET /expenses/:id", () => {
        test("should return expense by id", async () => {
            // Arrange
            const spy = vi.spyOn(ExpensesService, "getExpense").mockResolvedValue({
                success: true,
                data: mockExpense,
            });

            // Act
            const response = await app.handle(new Request("http://localhost/expenses/1"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.id).toBe(1);

            spy.mockRestore();
        });

        test("should return error when expense not found", async () => {
            // Arrange
            const spy = vi.spyOn(ExpensesService, "getExpense").mockResolvedValue({
                success: false,
                error: "Expense not found",
            });

            // Act
            const response = await app.handle(new Request("http://localhost/expenses/999"));
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Expense not found");

            spy.mockRestore();
        });

        test("should call service with id=0", async () => {
            // Arrange
            const spy = vi.spyOn(ExpensesService, "getExpense").mockResolvedValue({
                success: false,
                error: "Expense not found",
            });

            // Act
            const response = await app.handle(new Request("http://localhost/expenses/0"));
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Expense not found");

            spy.mockRestore();
        });
    });

    describe("POST /expenses", () => {
        test("should create expense with valid data", async () => {
            // Arrange
            const spy = vi.spyOn(ExpensesService, "createExpense").mockResolvedValue({
                success: true,
                data: mockExpense,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/expenses", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: "Office Rent",
                        amount: 5000,
                        description: "Monthly rent",
                        expenseDate: "2024-06-01",
                    }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.name).toBe("Office Rent");

            spy.mockRestore();
        });

        test("should pass context to service", async () => {
            // Arrange
            const spy = vi.spyOn(ExpensesService, "createExpense").mockResolvedValue({
                success: true,
                data: mockExpense,
            });

            // Act
            await app.handle(
                new Request("http://localhost/expenses", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: "Office Rent",
                        amount: 5000,
                        description: null,
                        expenseDate: "2024-06-01",
                    }),
                }),
            );

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ name: "Office Rent" }),
                expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should return error when service fails", async () => {
            // Arrange
            const spy = vi.spyOn(ExpensesService, "createExpense").mockResolvedValue({
                success: false,
                error: "Database error",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/expenses", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: "Test",
                        amount: 100,
                        description: null,
                        expenseDate: "2024-06-01",
                    }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);

            spy.mockRestore();
        });
    });

    describe("PATCH /expenses/:id", () => {
        test("should update expense", async () => {
            // Arrange
            const updatedExpense = { ...mockExpense, name: "Updated Rent" };
            const spy = vi.spyOn(ExpensesService, "updateExpense").mockResolvedValue({
                success: true,
                data: updatedExpense,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/expenses/1", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "Updated Rent" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.name).toBe("Updated Rent");

            spy.mockRestore();
        });

        test("should return error when expense not found", async () => {
            // Arrange
            const spy = vi.spyOn(ExpensesService, "updateExpense").mockResolvedValue({
                success: false,
                error: "Expense not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/expenses/999", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "New Name" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Expense not found");

            spy.mockRestore();
        });

        test("should return error when updating deleted expense", async () => {
            // Arrange
            const spy = vi.spyOn(ExpensesService, "updateExpense").mockResolvedValue({
                success: false,
                error: "Cannot update deleted expense",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/expenses/1", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "New Name" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Cannot update deleted expense");

            spy.mockRestore();
        });

        test("should handle empty body update", async () => {
            // Arrange
            const spy = vi.spyOn(ExpensesService, "updateExpense").mockResolvedValue({
                success: true,
                data: mockExpense,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/expenses/1", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);

            spy.mockRestore();
        });
    });

    describe("DELETE /expenses/:id", () => {
        test("should soft delete expense", async () => {
            // Arrange
            const deletedExpense = { ...mockExpense, deletedAt: new Date() };
            const spy = vi.spyOn(ExpensesService, "deleteExpense").mockResolvedValue({
                success: true,
                data: deletedExpense,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/expenses/1", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);

            spy.mockRestore();
        });

        test("should return error when expense not found", async () => {
            // Arrange
            const spy = vi.spyOn(ExpensesService, "deleteExpense").mockResolvedValue({
                success: false,
                error: "Expense not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/expenses/999", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Expense not found");

            spy.mockRestore();
        });

        test("should return error when expense already deleted", async () => {
            // Arrange
            const spy = vi.spyOn(ExpensesService, "deleteExpense").mockResolvedValue({
                success: false,
                error: "Expense already deleted",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/expenses/1", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Expense already deleted");

            spy.mockRestore();
        });
    });

    describe("POST /expenses/:id/restore", () => {
        test("should restore deleted expense", async () => {
            // Arrange
            const restoredExpense = { ...mockExpense, deletedAt: null };
            const spy = vi.spyOn(ExpensesService, "restoreExpense").mockResolvedValue({
                success: true,
                data: restoredExpense,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/expenses/1/restore", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);

            spy.mockRestore();
        });

        test("should return error when expense not found", async () => {
            // Arrange
            const spy = vi.spyOn(ExpensesService, "restoreExpense").mockResolvedValue({
                success: false,
                error: "Expense not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/expenses/999/restore", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Expense not found");

            spy.mockRestore();
        });

        test("should return error when expense is not deleted", async () => {
            // Arrange
            const spy = vi.spyOn(ExpensesService, "restoreExpense").mockResolvedValue({
                success: false,
                error: "Expense is not deleted",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/expenses/1/restore", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Expense is not deleted");

            spy.mockRestore();
        });
    });
});
