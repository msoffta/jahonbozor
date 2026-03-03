import { describe, test, expect, beforeEach } from "bun:test";
import { prismaMock, createMockLogger, expectSuccess, expectFailure } from "@backend/test/setup";
import { ExpensesService } from "../expenses.service";
import type { Token } from "@jahonbozor/schemas";
import type { Expense, AuditLog } from "@backend/generated/prisma/client";

const mockUser: Token = {
    id: 1,
    type: "staff" as const,
    fullname: "Test Admin",
    username: "testadmin",
    roleId: 1,
};

const mockContext = {
    staffId: 1,
    user: mockUser,
    requestId: "test-request-id",
};

// Factory for creating Expense mock data
const createMockExpense = (overrides: Partial<Expense> = {}): Expense => ({
    id: 1,
    name: "Office Rent",
    amount: 5000 as unknown as Expense["amount"],
    description: "Monthly rent payment",
    expenseDate: new Date("2024-06-01"),
    staffId: 1,
    deletedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// Factory for creating AuditLog mock data
const createMockAuditLog = (overrides: Partial<AuditLog> = {}): AuditLog => ({
    id: 1,
    requestId: "test-request-id",
    actorId: 1,
    actorType: "STAFF",
    entityType: "expense",
    entityId: 1,
    action: "CREATE",
    previousData: null,
    newData: null,
    metadata: null,
    createdAt: new Date("2024-01-01"),
    ...overrides,
});

describe("ExpensesService", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeEach(() => {
        mockLogger = createMockLogger();
    });

    describe("getAllExpenses", () => {
        test("should return paginated expenses", async () => {
            // Arrange
            const mockExpenses = [
                createMockExpense({ id: 1, name: "Rent" }),
                createMockExpense({ id: 2, name: "Utilities" }),
            ];

            prismaMock.$transaction.mockResolvedValue([2, mockExpenses]);

            // Act
            const result = await ExpensesService.getAllExpenses(
                { page: 1, limit: 20, searchQuery: "", includeDeleted: false },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ count: 2, expenses: mockExpenses });
        });

        test("should filter by searchQuery", async () => {
            // Arrange
            const mockExpenses = [createMockExpense({ id: 1, name: "Office Rent" })];
            prismaMock.$transaction.mockResolvedValue([1, mockExpenses]);

            // Act
            const result = await ExpensesService.getAllExpenses(
                { page: 1, limit: 20, searchQuery: "Rent", includeDeleted: false },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.count).toBe(1);
        });

        test("should filter by staffId", async () => {
            // Arrange
            const mockExpenses = [createMockExpense({ id: 1, staffId: 2 })];
            prismaMock.$transaction.mockResolvedValue([1, mockExpenses]);

            // Act
            const result = await ExpensesService.getAllExpenses(
                { page: 1, limit: 20, searchQuery: "", staffId: 2, includeDeleted: false },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.count).toBe(1);
        });

        test("should filter by date range", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([0, []]);

            // Act
            const result = await ExpensesService.getAllExpenses(
                {
                    page: 1,
                    limit: 20,
                    searchQuery: "",
                    dateFrom: "2024-01-01",
                    dateTo: "2024-12-31",
                    includeDeleted: false,
                },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.count).toBe(0);
        });

        test("should include deleted expenses when includeDeleted is true", async () => {
            // Arrange
            const deletedExpense = createMockExpense({ id: 1, deletedAt: new Date() });
            prismaMock.$transaction.mockResolvedValue([1, [deletedExpense]]);

            // Act
            const result = await ExpensesService.getAllExpenses(
                { page: 1, limit: 20, searchQuery: "", includeDeleted: true },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.count).toBe(1);
        });

        test("should return empty list when no expenses exist", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([0, []]);

            // Act
            const result = await ExpensesService.getAllExpenses(
                { page: 1, limit: 20, searchQuery: "", includeDeleted: false },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ count: 0, expenses: [] });
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.$transaction.mockRejectedValue(dbError);

            // Act
            const result = await ExpensesService.getAllExpenses(
                { page: 1, limit: 20, searchQuery: "", includeDeleted: false },
                mockLogger,
            );

            // Assert
            expectFailure(result);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("getExpense", () => {
        test("should return expense by id", async () => {
            // Arrange
            const mockExpense = createMockExpense({ id: 1 });
            prismaMock.expense.findUnique.mockResolvedValue(mockExpense);

            // Act
            const result = await ExpensesService.getExpense(1, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual(mockExpense);
        });

        test("should return error when expense not found", async () => {
            // Arrange
            prismaMock.expense.findUnique.mockResolvedValue(null);

            // Act
            const result = await ExpensesService.getExpense(999, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Expense not found");
            expect(mockLogger.warn).toHaveBeenCalled();
        });

        test("should return not found for id=0", async () => {
            // Arrange
            prismaMock.expense.findUnique.mockResolvedValue(null);

            // Act
            const result = await ExpensesService.getExpense(0, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Expense not found");
        });

        test("should return not found for negative id", async () => {
            // Arrange
            prismaMock.expense.findUnique.mockResolvedValue(null);

            // Act
            const result = await ExpensesService.getExpense(-1, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Expense not found");
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.expense.findUnique.mockRejectedValue(dbError);

            // Act
            const result = await ExpensesService.getExpense(1, mockLogger);

            // Assert
            expectFailure(result);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("createExpense", () => {
        test("should create expense successfully", async () => {
            // Arrange
            const mockExpense = createMockExpense({ id: 1, name: "New Expense" });
            prismaMock.expense.create.mockResolvedValue(mockExpense);
            prismaMock.auditLog.create.mockResolvedValue(createMockAuditLog());

            // Act
            const result = await ExpensesService.createExpense(
                { name: "New Expense", amount: 5000, description: null, expenseDate: new Date("2024-06-01") },
                mockContext,
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.id).toBe(1);
            expect(mockLogger.info).toHaveBeenCalled();
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.$transaction.mockRejectedValue(dbError);

            // Act
            const result = await ExpensesService.createExpense(
                { name: "New Expense", amount: 5000, description: null, expenseDate: new Date("2024-06-01") },
                mockContext,
                mockLogger,
            );

            // Assert
            expectFailure(result);
            expect(mockLogger.error).toHaveBeenCalled();
        });

        test("should handle database constraint violation on create", async () => {
            // Arrange
            const constraintError = new Error("Unique constraint failed");
            prismaMock.$transaction.mockRejectedValue(constraintError);

            // Act
            const result = await ExpensesService.createExpense(
                { name: "Duplicate", amount: 100, description: null, expenseDate: new Date("2024-06-01") },
                mockContext,
                mockLogger,
            );

            // Assert
            expectFailure(result);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("updateExpense", () => {
        test("should update expense successfully", async () => {
            // Arrange
            const existingExpense = createMockExpense({ id: 1, name: "Old Name" });
            const updatedExpense = createMockExpense({ id: 1, name: "New Name" });

            prismaMock.expense.findUnique.mockResolvedValue(existingExpense);
            prismaMock.expense.update.mockResolvedValue(updatedExpense);
            prismaMock.auditLog.create.mockResolvedValue(createMockAuditLog({ action: "UPDATE" }));

            // Act
            const result = await ExpensesService.updateExpense(
                1,
                { name: "New Name" },
                mockContext,
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.name).toBe("New Name");
            expect(mockLogger.info).toHaveBeenCalled();
        });

        test("should return error when expense not found", async () => {
            // Arrange
            prismaMock.expense.findUnique.mockResolvedValue(null);

            // Act
            const result = await ExpensesService.updateExpense(
                999,
                { name: "New Name" },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Expense not found");
        });

        test("should return error when updating deleted expense", async () => {
            // Arrange
            const deletedExpense = createMockExpense({ id: 1, deletedAt: new Date() });
            prismaMock.expense.findUnique.mockResolvedValue(deletedExpense);

            // Act
            const result = await ExpensesService.updateExpense(
                1,
                { name: "New Name" },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Cannot update deleted expense");
        });

        test("should succeed with empty update body (no-op)", async () => {
            // Arrange
            const existingExpense = createMockExpense({ id: 1 });
            prismaMock.expense.findUnique.mockResolvedValue(existingExpense);
            prismaMock.expense.update.mockResolvedValue(existingExpense);
            prismaMock.auditLog.create.mockResolvedValue(createMockAuditLog({ action: "UPDATE" }));

            // Act
            const result = await ExpensesService.updateExpense(
                1,
                {},
                mockContext,
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.id).toBe(1);
        });

        test("should handle database error", async () => {
            // Arrange
            const existingExpense = createMockExpense({ id: 1 });
            prismaMock.expense.findUnique.mockResolvedValue(existingExpense);
            prismaMock.$transaction.mockRejectedValue(new Error("Transaction failed"));

            // Act
            const result = await ExpensesService.updateExpense(
                1,
                { name: "New Name" },
                mockContext,
                mockLogger,
            );

            // Assert
            expectFailure(result);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("deleteExpense", () => {
        test("should soft delete expense successfully", async () => {
            // Arrange
            const existingExpense = createMockExpense({ id: 1, deletedAt: null });
            const deletedExpense = createMockExpense({ id: 1, deletedAt: new Date() });

            prismaMock.expense.findUnique.mockResolvedValue(existingExpense);
            prismaMock.expense.update.mockResolvedValue(deletedExpense);
            prismaMock.auditLog.create.mockResolvedValue(createMockAuditLog({ action: "DELETE" }));

            // Act
            const result = await ExpensesService.deleteExpense(1, mockContext, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.deletedAt).not.toBeNull();
            expect(mockLogger.info).toHaveBeenCalled();
        });

        test("should return error when expense not found", async () => {
            // Arrange
            prismaMock.expense.findUnique.mockResolvedValue(null);

            // Act
            const result = await ExpensesService.deleteExpense(999, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Expense not found");
        });

        test("should return error when expense already deleted", async () => {
            // Arrange
            const deletedExpense = createMockExpense({ id: 1, deletedAt: new Date() });
            prismaMock.expense.findUnique.mockResolvedValue(deletedExpense);

            // Act
            const result = await ExpensesService.deleteExpense(1, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Expense already deleted");
        });

        test("should handle database error during delete transaction", async () => {
            // Arrange
            const existingExpense = createMockExpense({ id: 1 });
            prismaMock.expense.findUnique.mockResolvedValue(existingExpense);
            prismaMock.$transaction.mockRejectedValue(new Error("Transaction failed"));

            // Act
            const result = await ExpensesService.deleteExpense(1, mockContext, mockLogger);

            // Assert
            expectFailure(result);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("restoreExpense", () => {
        test("should restore deleted expense successfully", async () => {
            // Arrange
            const deletedExpense = createMockExpense({ id: 1, deletedAt: new Date() });
            const restoredExpense = createMockExpense({ id: 1, deletedAt: null });

            prismaMock.expense.findUnique.mockResolvedValue(deletedExpense);
            prismaMock.expense.update.mockResolvedValue(restoredExpense);
            prismaMock.auditLog.create.mockResolvedValue(createMockAuditLog({ action: "RESTORE" }));

            // Act
            const result = await ExpensesService.restoreExpense(1, mockContext, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.deletedAt).toBeNull();
            expect(mockLogger.info).toHaveBeenCalled();
        });

        test("should return error when expense not found", async () => {
            // Arrange
            prismaMock.expense.findUnique.mockResolvedValue(null);

            // Act
            const result = await ExpensesService.restoreExpense(999, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Expense not found");
        });

        test("should return error when expense is not deleted", async () => {
            // Arrange
            const activeExpense = createMockExpense({ id: 1, deletedAt: null });
            prismaMock.expense.findUnique.mockResolvedValue(activeExpense);

            // Act
            const result = await ExpensesService.restoreExpense(1, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Expense is not deleted");
        });

        test("should handle database error during restore transaction", async () => {
            // Arrange
            const deletedExpense = createMockExpense({ id: 1, deletedAt: new Date() });
            prismaMock.expense.findUnique.mockResolvedValue(deletedExpense);
            prismaMock.$transaction.mockRejectedValue(new Error("Transaction failed"));

            // Act
            const result = await ExpensesService.restoreExpense(1, mockContext, mockLogger);

            // Assert
            expectFailure(result);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });
});
