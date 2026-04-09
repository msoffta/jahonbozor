import { beforeEach, describe, expect, test } from "vitest";

import { createMockLogger, expectSuccess, prismaMock } from "@backend/test/setup";

import { ProductsService } from "../products.service";

import type { Product } from "@backend/generated/prisma/client";
import type { Token } from "@jahonbozor/schemas";

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

const createMockProduct = (overrides: Partial<Product> = {}): Product => ({
    id: 1,
    name: "Test Product",
    price: 100 as unknown as Product["price"],
    costprice: 50 as unknown as Product["costprice"],
    categoryId: null,
    staffId: null,
    remaining: 10,
    deletedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

describe("ProductsService.importProducts", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeEach(() => {
        mockLogger = createMockLogger();
    });

    test("should create all new products when none exist", async () => {
        // Arrange
        const rows = [
            { name: "Product A", price: 100, costprice: 50, remaining: 10 },
            { name: "Product B", price: 200, costprice: 100, remaining: 5 },
        ];

        prismaMock.product.findMany.mockResolvedValue([]);
        prismaMock.product.create
            .mockResolvedValueOnce(createMockProduct({ id: 1, name: "Product A", remaining: 10 }))
            .mockResolvedValueOnce(createMockProduct({ id: 2, name: "Product B", remaining: 5 }));
        prismaMock.productHistory.createMany.mockResolvedValue({ count: 0 });
        prismaMock.auditLog.create.mockResolvedValue({} as never);

        // Act
        const result = await ProductsService.importProducts(rows, mockContext, mockLogger);

        // Assert
        const success = expectSuccess(result);
        expect(success.data).toEqual({ created: 2, updated: 0, total: 2 });
        expect(prismaMock.product.create).toHaveBeenCalledTimes(2);
        expect(prismaMock.product.update).not.toHaveBeenCalled();
    });

    test("should update existing products matched by name", async () => {
        // Arrange
        const existing = createMockProduct({ id: 5, name: "Existing Product", remaining: 3 });
        const rows = [{ name: "Existing Product", price: 300, costprice: 150, remaining: 20 }];

        prismaMock.product.findMany.mockResolvedValue([existing]);
        prismaMock.product.update.mockResolvedValue(
            createMockProduct({ id: 5, name: "Existing Product", remaining: 20 }),
        );
        prismaMock.productHistory.createMany.mockResolvedValue({ count: 0 });
        prismaMock.auditLog.create.mockResolvedValue({} as never);

        // Act
        const result = await ProductsService.importProducts(rows, mockContext, mockLogger);

        // Assert
        const success = expectSuccess(result);
        expect(success.data).toEqual({ created: 0, updated: 1, total: 1 });
        expect(prismaMock.product.update).toHaveBeenCalledWith({
            where: { id: 5 },
            data: { price: 300, costprice: 150, remaining: 20 },
        });
    });

    test("should match product names case-insensitively", async () => {
        // Arrange
        const existing = createMockProduct({ id: 3, name: "BOLT GAYKA" });
        const rows = [{ name: "bolt gayka", price: 500, costprice: 200, remaining: 100 }];

        prismaMock.product.findMany.mockResolvedValue([existing]);
        prismaMock.product.update.mockResolvedValue(
            createMockProduct({ id: 3, name: "BOLT GAYKA", remaining: 100 }),
        );
        prismaMock.productHistory.createMany.mockResolvedValue({ count: 0 });
        prismaMock.auditLog.create.mockResolvedValue({} as never);

        // Act
        const result = await ProductsService.importProducts(rows, mockContext, mockLogger);

        // Assert
        const success = expectSuccess(result);
        expect(success.data).toEqual({ created: 0, updated: 1, total: 1 });
    });

    test("should handle mix of new and existing products", async () => {
        // Arrange
        const existing = createMockProduct({ id: 1, name: "Existing" });
        const rows = [
            { name: "Existing", price: 100, costprice: 50, remaining: 5 },
            { name: "New Product", price: 200, costprice: 100, remaining: 10 },
        ];

        prismaMock.product.findMany.mockResolvedValue([existing]);
        prismaMock.product.update.mockResolvedValue(
            createMockProduct({ id: 1, name: "Existing", remaining: 5 }),
        );
        prismaMock.product.create.mockResolvedValue(
            createMockProduct({ id: 2, name: "New Product", remaining: 10 }),
        );
        prismaMock.productHistory.createMany.mockResolvedValue({ count: 0 });
        prismaMock.auditLog.create.mockResolvedValue({} as never);

        // Act
        const result = await ProductsService.importProducts(rows, mockContext, mockLogger);

        // Assert
        const success = expectSuccess(result);
        expect(success.data).toEqual({ created: 1, updated: 1, total: 2 });
    });

    test("should deduplicate names within CSV (second occurrence updates first-created)", async () => {
        // Arrange
        const rows = [
            { name: "Product A", price: 100, costprice: 50, remaining: 10 },
            { name: "Product A", price: 200, costprice: 80, remaining: 20 },
        ];

        prismaMock.product.findMany.mockResolvedValue([]);
        prismaMock.product.create.mockResolvedValue(
            createMockProduct({ id: 1, name: "Product A", remaining: 10 }),
        );
        prismaMock.product.update.mockResolvedValue(
            createMockProduct({ id: 1, name: "Product A", remaining: 20 }),
        );
        prismaMock.productHistory.createMany.mockResolvedValue({ count: 0 });
        prismaMock.auditLog.create.mockResolvedValue({} as never);

        // Act
        const result = await ProductsService.importProducts(rows, mockContext, mockLogger);

        // Assert
        const success = expectSuccess(result);
        expect(success.data).toEqual({ created: 1, updated: 1, total: 2 });
    });

    test("should create ProductHistory with changeReason 'CSV Import'", async () => {
        // Arrange
        const rows = [{ name: "New Product", price: 100, costprice: 50, remaining: 5 }];

        prismaMock.product.findMany.mockResolvedValue([]);
        prismaMock.product.create.mockResolvedValue(
            createMockProduct({ id: 1, name: "New Product", remaining: 5 }),
        );
        prismaMock.productHistory.createMany.mockResolvedValue({ count: 0 });
        prismaMock.auditLog.create.mockResolvedValue({} as never);

        // Act
        await ProductsService.importProducts(rows, mockContext, mockLogger);

        // Assert
        expect(prismaMock.productHistory.createMany).toHaveBeenCalledWith({
            data: expect.arrayContaining([
                expect.objectContaining({
                    operation: "CREATE",
                    changeReason: "CSV Import",
                    staffId: 1,
                }),
            ]),
        });
    });

    test("should allow negative remaining values", async () => {
        // Arrange
        const rows = [{ name: "Debt Product", price: 100, costprice: 50, remaining: -5 }];

        prismaMock.product.findMany.mockResolvedValue([]);
        prismaMock.product.create.mockResolvedValue(
            createMockProduct({ id: 1, name: "Debt Product", remaining: -5 }),
        );
        prismaMock.productHistory.createMany.mockResolvedValue({ count: 0 });
        prismaMock.auditLog.create.mockResolvedValue({} as never);

        // Act
        const result = await ProductsService.importProducts(rows, mockContext, mockLogger);

        // Assert
        const success = expectSuccess(result);
        expect(success.data).toEqual({ created: 1, updated: 0, total: 1 });
        expect(prismaMock.product.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ remaining: -5 }),
        });
    });

    test("should trim product names", async () => {
        // Arrange
        const rows = [{ name: "  Trimmed Product  ", price: 100, costprice: 50, remaining: 5 }];

        prismaMock.product.findMany.mockResolvedValue([]);
        prismaMock.product.create.mockResolvedValue(
            createMockProduct({ id: 1, name: "Trimmed Product" }),
        );
        prismaMock.productHistory.createMany.mockResolvedValue({ count: 0 });
        prismaMock.auditLog.create.mockResolvedValue({} as never);

        // Act
        await ProductsService.importProducts(rows, mockContext, mockLogger);

        // Assert
        expect(prismaMock.product.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ name: "Trimmed Product" }),
        });
    });

    test("should return error when transaction fails", async () => {
        // Arrange
        const rows = [{ name: "Product A", price: 100, costprice: 50, remaining: 10 }];

        prismaMock.product.findMany.mockResolvedValue([]);
        prismaMock.$transaction.mockRejectedValue(new Error("DB error"));

        // Act
        const result = await ProductsService.importProducts(rows, mockContext, mockLogger);

        // Assert
        expect(result.success).toBe(false);
    });

    test("should log import completion with counts", async () => {
        // Arrange
        const rows = [{ name: "Product A", price: 100, costprice: 50, remaining: 10 }];

        prismaMock.product.findMany.mockResolvedValue([]);
        prismaMock.product.create.mockResolvedValue(
            createMockProduct({ id: 1, name: "Product A" }),
        );
        prismaMock.productHistory.createMany.mockResolvedValue({ count: 0 });
        prismaMock.auditLog.create.mockResolvedValue({} as never);

        // Act
        await ProductsService.importProducts(rows, mockContext, mockLogger);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith(
            "Products: CSV import completed",
            expect.objectContaining({ created: 1, updated: 0, total: 1 }),
        );
    });
});
