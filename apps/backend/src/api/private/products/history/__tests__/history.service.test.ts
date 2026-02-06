import { describe, test, expect, beforeEach } from "bun:test";
import { prismaMock, createMockLogger, expectSuccess, expectFailure } from "@test/setup";
import { HistoryService } from "../history.service";
import type { Token } from "@jahonbozor/schemas";
import type { Product, ProductHistory, AuditLog } from "@generated/prisma/client";

const mockUser: Token = {
    id: 1,
    type: "staff" as const,
    fullname: "Test Admin",
    username: "testadmin",
    telegramId: "123456789",
    roleId: 1,
};

const mockContext = {
    staffId: 1,
    user: mockUser,
    requestId: "test-request-id",
};

// Factory for creating ProductHistory mock data
const createMockProductHistory = (overrides: Partial<ProductHistory> = {}): ProductHistory => ({
    id: 1,
    productId: 1,
    staffId: 1,
    operation: "CREATE",
    quantity: null,
    previousData: null,
    newData: null,
    changeReason: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// Factory for creating Product mock data
const createMockProduct = (overrides: Partial<Product> = {}): Product => ({
    id: 1,
    name: "Product 1",
    price: 100 as unknown as Product["price"],
    costprice: 50 as unknown as Product["costprice"],
    categoryId: 1,
    remaining: 10,
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
    entityType: "product",
    entityId: 1,
    action: "CREATE",
    previousData: null,
    newData: null,
    metadata: null,
    createdAt: new Date("2024-01-01"),
    ...overrides,
});

describe("HistoryService", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeEach(() => {
        mockLogger = createMockLogger();
    });

    describe("getAllHistory", () => {
        test("should return paginated history", async () => {
            // Arrange
            const mockHistory = [
                createMockProductHistory({ id: 1, productId: 1, operation: "CREATE" }),
                createMockProductHistory({ id: 2, productId: 2, operation: "UPDATE" }),
            ];

            prismaMock.productHistory.count.mockResolvedValue(2);
            prismaMock.productHistory.findMany.mockResolvedValue(mockHistory);

            // Act
            const result = await HistoryService.getAllHistory(
                { page: 1, limit: 20, searchQuery: "" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ count: 2, history: mockHistory });
        });

        test("should apply filters", async () => {
            // Arrange
            prismaMock.productHistory.count.mockResolvedValue(0);
            prismaMock.productHistory.findMany.mockResolvedValue([]);

            // Act
            await HistoryService.getAllHistory(
                { page: 1, limit: 20, searchQuery: "", productId: 1, operation: "CREATE", staffId: 1 },
                mockLogger,
            );

            // Assert
            expect(prismaMock.productHistory.findMany).toHaveBeenCalled();
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.$transaction.mockRejectedValue(dbError);

            // Act
            const result = await HistoryService.getAllHistory(
                { page: 1, limit: 20, searchQuery: "" },
                mockLogger,
            );

            // Assert
            expectFailure(result);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("getHistoryEntry", () => {
        test("should return history entry by id", async () => {
            // Arrange
            const mockEntry = createMockProductHistory({ id: 1, productId: 1, operation: "CREATE" });

            prismaMock.productHistory.findUnique.mockResolvedValue(mockEntry);

            // Act
            const result = await HistoryService.getHistoryEntry(1, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual(mockEntry);
        });

        test("should return error when entry not found", async () => {
            // Arrange
            prismaMock.productHistory.findUnique.mockResolvedValue(null);

            // Act
            const result = await HistoryService.getHistoryEntry(999, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("History entry not found");
        });
    });

    describe("getProductHistory", () => {
        test("should return history for specific product", async () => {
            // Arrange
            const mockHistory = [
                createMockProductHistory({ id: 1, productId: 1, operation: "CREATE" }),
            ];

            prismaMock.productHistory.count.mockResolvedValue(1);
            prismaMock.productHistory.findMany.mockResolvedValue(mockHistory);

            // Act
            const result = await HistoryService.getProductHistory(
                1,
                { page: 1, limit: 20, searchQuery: "" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ count: 1, history: mockHistory });
        });
    });

    describe("createInventoryAdjustment", () => {
        test("should add inventory successfully", async () => {
            // Arrange
            const mockProduct = createMockProduct({ id: 1, remaining: 10 });
            const mockUpdatedProduct = createMockProduct({ id: 1, remaining: 15 });
            const mockHistoryEntry = createMockProductHistory({
                id: 1,
                productId: 1,
                operation: "INVENTORY_ADD",
                quantity: 5,
            });

            prismaMock.product.findUnique.mockResolvedValue(mockProduct);
            prismaMock.product.update.mockResolvedValue(mockUpdatedProduct);
            prismaMock.productHistory.create.mockResolvedValue(mockHistoryEntry);
            prismaMock.auditLog.create.mockResolvedValue(createMockAuditLog({ action: "INVENTORY_ADJUST" }));

            // Act
            const result = await HistoryService.createInventoryAdjustment(
                1,
                { operation: "INVENTORY_ADD", quantity: 5, changeReason: null },
                mockContext,
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.product.remaining).toBe(15);
        });

        test("should remove inventory successfully", async () => {
            // Arrange
            const mockProduct = createMockProduct({ id: 1, remaining: 10 });
            const mockUpdatedProduct = createMockProduct({ id: 1, remaining: 7 });
            const mockHistoryEntry = createMockProductHistory({
                id: 1,
                productId: 1,
                operation: "INVENTORY_REMOVE",
                quantity: 3,
            });

            prismaMock.product.findUnique.mockResolvedValue(mockProduct);
            prismaMock.product.update.mockResolvedValue(mockUpdatedProduct);
            prismaMock.productHistory.create.mockResolvedValue(mockHistoryEntry);
            prismaMock.auditLog.create.mockResolvedValue(createMockAuditLog({ action: "INVENTORY_ADJUST" }));

            // Act
            const result = await HistoryService.createInventoryAdjustment(
                1,
                { operation: "INVENTORY_REMOVE", quantity: 3, changeReason: null },
                mockContext,
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.product.remaining).toBe(7);
        });

        test("should return error when product not found", async () => {
            // Arrange
            prismaMock.product.findUnique.mockResolvedValue(null);

            // Act
            const result = await HistoryService.createInventoryAdjustment(
                999,
                { operation: "INVENTORY_ADD", quantity: 5, changeReason: null },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Product not found");
        });

        test("should return error when product is deleted", async () => {
            // Arrange
            const deletedProduct = createMockProduct({ id: 1, remaining: 10, deletedAt: new Date() });
            prismaMock.product.findUnique.mockResolvedValue(deletedProduct);

            // Act
            const result = await HistoryService.createInventoryAdjustment(
                1,
                { operation: "INVENTORY_ADD", quantity: 5, changeReason: null },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Cannot adjust inventory for deleted product");
        });

        test("should return error when insufficient stock", async () => {
            // Arrange
            const mockProduct = createMockProduct({ id: 1, remaining: 5 });
            prismaMock.product.findUnique.mockResolvedValue(mockProduct);

            // Act
            const result = await HistoryService.createInventoryAdjustment(
                1,
                { operation: "INVENTORY_REMOVE", quantity: 10, changeReason: null },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Insufficient stock");
        });
    });
});
