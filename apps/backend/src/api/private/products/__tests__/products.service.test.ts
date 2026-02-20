import { describe, test, expect, beforeEach } from "bun:test";
import { prismaMock, createMockLogger, expectSuccess, expectFailure } from "@backend/test/setup";
import { ProductsService } from "../products.service";
import type { Token } from "@jahonbozor/schemas";
import type { Product, Category, ProductHistory, AuditLog } from "@backend/generated/prisma/client";

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

// Factory for creating Product mock data
const createMockProduct = (overrides: Partial<Product> = {}): Product => ({
    id: 1,
    name: "Test Product",
    price: 100 as unknown as Product["price"],
    costprice: 50 as unknown as Product["costprice"],
    categoryId: 1,
    remaining: 10,
    deletedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// Factory for creating Category mock data
const createMockCategory = (overrides: Partial<Category> = {}): Category => ({
    id: 1,
    name: "Test Category",
    parentId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

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

describe("ProductsService", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeEach(() => {
        mockLogger = createMockLogger();
    });

    describe("getAllProducts", () => {
        test("should return paginated products", async () => {
            // Arrange
            const mockProducts = [
                createMockProduct({ id: 1, name: "Product 1" }),
                createMockProduct({ id: 2, name: "Product 2" }),
            ];

            prismaMock.$transaction.mockResolvedValue([2, mockProducts]);

            // Act
            const result = await ProductsService.getAllProducts(
                { page: 1, limit: 20, searchQuery: "", includeDeleted: false },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ count: 2, products: mockProducts });
        });

        test("should filter by searchQuery", async () => {
            // Arrange
            const mockProducts = [createMockProduct({ id: 1, name: "iPhone" })];
            prismaMock.$transaction.mockResolvedValue([1, mockProducts]);

            // Act
            const result = await ProductsService.getAllProducts(
                { page: 1, limit: 20, searchQuery: "iPhone", includeDeleted: false },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.count).toBe(1);
        });

        test("should filter by categoryId with descendants", async () => {
            // Arrange
            const mockProducts = [createMockProduct({ id: 1, categoryId: 1 })];

            // Mock category hierarchy: parent (1) -> child (2)
            prismaMock.category.findMany
                .mockResolvedValueOnce([createMockCategory({ id: 2, parentId: 1 })]) // children of category 1
                .mockResolvedValueOnce([]); // children of category 2 (none)

            prismaMock.$transaction.mockResolvedValue([1, mockProducts]);

            // Act
            const result = await ProductsService.getAllProducts(
                { page: 1, limit: 20, searchQuery: "", categoryIds: "1", includeDeleted: false },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.count).toBe(1);
        });

        test("should filter by price range", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([0, []]);

            // Act
            await ProductsService.getAllProducts(
                { page: 1, limit: 20, searchQuery: "", minPrice: 50, maxPrice: 150, includeDeleted: false },
                mockLogger,
            );

            // Assert
            expect(prismaMock.$transaction).toHaveBeenCalled();
        });

        test("should include deleted products when includeDeleted is true", async () => {
            // Arrange
            const deletedProduct = createMockProduct({ id: 1, deletedAt: new Date() });
            prismaMock.$transaction.mockResolvedValue([1, [deletedProduct]]);

            // Act
            const result = await ProductsService.getAllProducts(
                { page: 1, limit: 20, searchQuery: "", includeDeleted: true },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.count).toBe(1);
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.$transaction.mockRejectedValue(dbError);

            // Act
            const result = await ProductsService.getAllProducts(
                { page: 1, limit: 20, searchQuery: "", includeDeleted: false },
                mockLogger,
            );

            // Assert
            expectFailure(result);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("getProduct", () => {
        test("should return product by id", async () => {
            // Arrange
            const mockProduct = createMockProduct({ id: 1, name: "Test Product" });
            prismaMock.product.findUnique.mockResolvedValue(mockProduct);

            // Act
            const result = await ProductsService.getProduct(1, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual(mockProduct);
        });

        test("should return error when product not found", async () => {
            // Arrange
            prismaMock.product.findUnique.mockResolvedValue(null);

            // Act
            const result = await ProductsService.getProduct(999, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Product not found");
            expect(mockLogger.warn).toHaveBeenCalled();
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.product.findUnique.mockRejectedValue(dbError);

            // Act
            const result = await ProductsService.getProduct(1, mockLogger);

            // Assert
            expectFailure(result);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("createProduct", () => {
        test("should create product successfully", async () => {
            // Arrange
            const mockCategory = createMockCategory({ id: 1 });
            const mockProduct = createMockProduct({ id: 1, name: "New Product" });

            prismaMock.category.findUnique.mockResolvedValue(mockCategory);
            prismaMock.product.create.mockResolvedValue(mockProduct);
            prismaMock.productHistory.create.mockResolvedValue(createMockProductHistory());
            prismaMock.auditLog.create.mockResolvedValue(createMockAuditLog());

            // Act
            const result = await ProductsService.createProduct(
                { name: "New Product", price: 100, costprice: 50, categoryId: 1, remaining: 0 },
                mockContext,
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.id).toBe(1);
            expect(mockLogger.info).toHaveBeenCalled();
        });

        test("should return error when category not found", async () => {
            // Arrange
            prismaMock.category.findUnique.mockResolvedValue(null);

            // Act
            const result = await ProductsService.createProduct(
                { name: "New Product", price: 100, costprice: 50, categoryId: 999, remaining: 0 },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Category not found");
            expect(mockLogger.warn).toHaveBeenCalled();
        });

        test("should handle database error", async () => {
            // Arrange
            const mockCategory = createMockCategory({ id: 1 });
            const dbError = new Error("Database error");

            prismaMock.category.findUnique.mockResolvedValue(mockCategory);
            prismaMock.$transaction.mockRejectedValue(dbError);

            // Act
            const result = await ProductsService.createProduct(
                { name: "New Product", price: 100, costprice: 50, categoryId: 1, remaining: 0 },
                mockContext,
                mockLogger,
            );

            // Assert
            expectFailure(result);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("updateProduct", () => {
        test("should update product successfully", async () => {
            // Arrange
            const existingProduct = createMockProduct({ id: 1, name: "Old Name" });
            const updatedProduct = createMockProduct({ id: 1, name: "New Name" });

            prismaMock.product.findUnique.mockResolvedValue(existingProduct);
            prismaMock.product.update.mockResolvedValue(updatedProduct);
            prismaMock.productHistory.create.mockResolvedValue(createMockProductHistory({ operation: "UPDATE" }));
            prismaMock.auditLog.create.mockResolvedValue(createMockAuditLog({ action: "UPDATE" }));

            // Act
            const result = await ProductsService.updateProduct(
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

        test("should return error when product not found", async () => {
            // Arrange
            prismaMock.product.findUnique.mockResolvedValue(null);

            // Act
            const result = await ProductsService.updateProduct(
                999,
                { name: "New Name" },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Product not found");
        });

        test("should return error when updating deleted product", async () => {
            // Arrange
            const deletedProduct = createMockProduct({ id: 1, deletedAt: new Date() });
            prismaMock.product.findUnique.mockResolvedValue(deletedProduct);

            // Act
            const result = await ProductsService.updateProduct(
                1,
                { name: "New Name" },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Cannot update deleted product");
        });

        test("should validate new categoryId exists", async () => {
            // Arrange
            const existingProduct = createMockProduct({ id: 1, categoryId: 1 });

            prismaMock.product.findUnique.mockResolvedValue(existingProduct);
            prismaMock.category.findUnique.mockResolvedValue(null); // new category doesn't exist

            // Act
            const result = await ProductsService.updateProduct(
                1,
                { categoryId: 999 },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Category not found");
        });

        test("should allow category change when new category exists", async () => {
            // Arrange
            const existingProduct = createMockProduct({ id: 1, categoryId: 1 });
            const newCategory = createMockCategory({ id: 2 });
            const updatedProduct = createMockProduct({ id: 1, categoryId: 2 });

            prismaMock.product.findUnique.mockResolvedValue(existingProduct);
            prismaMock.category.findUnique.mockResolvedValue(newCategory);
            prismaMock.product.update.mockResolvedValue(updatedProduct);
            prismaMock.productHistory.create.mockResolvedValue(createMockProductHistory({ operation: "UPDATE" }));
            prismaMock.auditLog.create.mockResolvedValue(createMockAuditLog({ action: "UPDATE" }));

            // Act
            const result = await ProductsService.updateProduct(
                1,
                { categoryId: 2 },
                mockContext,
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.categoryId).toBe(2);
        });
    });

    describe("deleteProduct", () => {
        test("should soft delete product successfully", async () => {
            // Arrange
            const existingProduct = createMockProduct({ id: 1, deletedAt: null });
            const deletedProduct = createMockProduct({ id: 1, deletedAt: new Date() });

            prismaMock.product.findUnique.mockResolvedValue(existingProduct);
            prismaMock.product.update.mockResolvedValue(deletedProduct);
            prismaMock.productHistory.create.mockResolvedValue(createMockProductHistory({ operation: "DELETE" }));
            prismaMock.auditLog.create.mockResolvedValue(createMockAuditLog({ action: "DELETE" }));

            // Act
            const result = await ProductsService.deleteProduct(1, mockContext, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.deletedAt).not.toBeNull();
            expect(mockLogger.info).toHaveBeenCalled();
        });

        test("should return error when product not found", async () => {
            // Arrange
            prismaMock.product.findUnique.mockResolvedValue(null);

            // Act
            const result = await ProductsService.deleteProduct(999, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Product not found");
        });

        test("should return error when product already deleted", async () => {
            // Arrange
            const deletedProduct = createMockProduct({ id: 1, deletedAt: new Date() });
            prismaMock.product.findUnique.mockResolvedValue(deletedProduct);

            // Act
            const result = await ProductsService.deleteProduct(1, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Product already deleted");
        });
    });

    describe("restoreProduct", () => {
        test("should restore deleted product successfully", async () => {
            // Arrange
            const deletedProduct = createMockProduct({ id: 1, deletedAt: new Date() });
            const restoredProduct = createMockProduct({ id: 1, deletedAt: null });

            prismaMock.product.findUnique.mockResolvedValue(deletedProduct);
            prismaMock.product.update.mockResolvedValue(restoredProduct);
            prismaMock.productHistory.create.mockResolvedValue(createMockProductHistory({ operation: "RESTORE" }));
            prismaMock.auditLog.create.mockResolvedValue(createMockAuditLog({ action: "RESTORE" }));

            // Act
            const result = await ProductsService.restoreProduct(1, mockContext, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.deletedAt).toBeNull();
            expect(mockLogger.info).toHaveBeenCalled();
        });

        test("should return error when product not found", async () => {
            // Arrange
            prismaMock.product.findUnique.mockResolvedValue(null);

            // Act
            const result = await ProductsService.restoreProduct(999, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Product not found");
        });

        test("should return error when product is not deleted", async () => {
            // Arrange
            const activeProduct = createMockProduct({ id: 1, deletedAt: null });
            prismaMock.product.findUnique.mockResolvedValue(activeProduct);

            // Act
            const result = await ProductsService.restoreProduct(1, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Product is not deleted");
        });
    });

    describe("edge cases", () => {
        describe("getAllProducts", () => {
            test("should return empty list when no products exist", async () => {
                prismaMock.$transaction.mockResolvedValue([0, []]);

                const result = await ProductsService.getAllProducts(
                    { page: 1, limit: 20, searchQuery: "", includeDeleted: false },
                    mockLogger,
                );

                const success = expectSuccess(result);
                expect(success.data).toEqual({ count: 0, products: [] });
            });

            test("should handle categoryIds with NaN values gracefully", async () => {
                prismaMock.category.findMany.mockResolvedValue([]);
                prismaMock.$transaction.mockResolvedValue([0, []]);

                const result = await ProductsService.getAllProducts(
                    { page: 1, limit: 20, searchQuery: "", categoryIds: "abc,def", includeDeleted: false },
                    mockLogger,
                );

                const success = expectSuccess(result);
                expect(success.data?.count).toBe(0);
            });

            test("should handle empty categoryIds string", async () => {
                prismaMock.$transaction.mockResolvedValue([0, []]);

                const result = await ProductsService.getAllProducts(
                    { page: 1, limit: 20, searchQuery: "", categoryIds: "", includeDeleted: false },
                    mockLogger,
                );

                const success = expectSuccess(result);
                expect(success.data?.count).toBe(0);
            });

            test("should handle minPrice and maxPrice together (range)", async () => {
                prismaMock.$transaction.mockResolvedValue([0, []]);

                const result = await ProductsService.getAllProducts(
                    { page: 1, limit: 20, searchQuery: "", minPrice: 100, maxPrice: 50, includeDeleted: false },
                    mockLogger,
                );

                // Inverted range (min > max) returns empty — no error
                const success = expectSuccess(result);
                expect(success.data?.count).toBe(0);
            });
        });

        describe("getProduct", () => {
            test("should return not found for id=0", async () => {
                prismaMock.product.findUnique.mockResolvedValue(null);

                const result = await ProductsService.getProduct(0, mockLogger);

                const failure = expectFailure(result);
                expect(failure.error).toBe("Product not found");
            });

            test("should return not found for negative id", async () => {
                prismaMock.product.findUnique.mockResolvedValue(null);

                const result = await ProductsService.getProduct(-1, mockLogger);

                const failure = expectFailure(result);
                expect(failure.error).toBe("Product not found");
            });
        });

        describe("updateProduct", () => {
            test("should succeed with empty update body (no-op)", async () => {
                const existingProduct = createMockProduct({ id: 1 });
                prismaMock.product.findUnique.mockResolvedValue(existingProduct);
                prismaMock.product.update.mockResolvedValue(existingProduct);
                prismaMock.productHistory.create.mockResolvedValue(createMockProductHistory({ operation: "UPDATE" }));
                prismaMock.auditLog.create.mockResolvedValue(createMockAuditLog({ action: "UPDATE" }));

                const result = await ProductsService.updateProduct(
                    1,
                    {},
                    mockContext,
                    mockLogger,
                );

                const success = expectSuccess(result);
                expect(success.data?.id).toBe(1);
            });

            test("should skip category check when categoryId unchanged", async () => {
                const existingProduct = createMockProduct({ id: 1, categoryId: 1 });
                prismaMock.product.findUnique.mockResolvedValue(existingProduct);
                prismaMock.product.update.mockResolvedValue(existingProduct);
                prismaMock.productHistory.create.mockResolvedValue(createMockProductHistory({ operation: "UPDATE" }));
                prismaMock.auditLog.create.mockResolvedValue(createMockAuditLog({ action: "UPDATE" }));

                const result = await ProductsService.updateProduct(
                    1,
                    { categoryId: 1 },
                    mockContext,
                    mockLogger,
                );

                const success = expectSuccess(result);
                expect(prismaMock.category.findUnique).not.toHaveBeenCalled();
            });
        });

        describe("createProduct", () => {
            test("should handle database constraint violation on create", async () => {
                const mockCategory = createMockCategory({ id: 1 });
                prismaMock.category.findUnique.mockResolvedValue(mockCategory);

                const constraintError = new Error("Unique constraint failed");
                prismaMock.$transaction.mockRejectedValue(constraintError);

                const result = await ProductsService.createProduct(
                    { name: "Duplicate", price: 100, costprice: 50, categoryId: 1, remaining: 0 },
                    mockContext,
                    mockLogger,
                );

                expectFailure(result);
                expect(mockLogger.error).toHaveBeenCalled();
            });
        });

        describe("deleteProduct and restoreProduct", () => {
            test("should handle database error during delete transaction", async () => {
                const existingProduct = createMockProduct({ id: 1 });
                prismaMock.product.findUnique.mockResolvedValue(existingProduct);
                prismaMock.$transaction.mockRejectedValue(new Error("Transaction failed"));

                const result = await ProductsService.deleteProduct(1, mockContext, mockLogger);

                expectFailure(result);
                expect(mockLogger.error).toHaveBeenCalled();
            });

            test("should handle database error during restore transaction", async () => {
                const deletedProduct = createMockProduct({ id: 1, deletedAt: new Date() });
                prismaMock.product.findUnique.mockResolvedValue(deletedProduct);
                prismaMock.$transaction.mockRejectedValue(new Error("Transaction failed"));

                const result = await ProductsService.restoreProduct(1, mockContext, mockLogger);

                expectFailure(result);
                expect(mockLogger.error).toHaveBeenCalled();
            });
        });
    });
});
