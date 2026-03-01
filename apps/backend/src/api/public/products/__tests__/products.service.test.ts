import { describe, test, expect, beforeEach } from "bun:test";
import { prismaMock, createMockLogger, expectSuccess, expectFailure } from "@backend/test/setup";
import type { Product, Category } from "@backend/generated/prisma/client";
import { PublicProductsService } from "../products.service";

const mockCategory = {
    id: 1,
    name: "Инструменты",
    parentId: null,
    parent: null,
};

const mockProduct = {
    id: 1,
    name: "Отвертка",
    price: 15000 as unknown as Product["price"],
    categoryId: 1,
    remaining: 10,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    category: mockCategory,
};

const mockProduct2 = {
    id: 2,
    name: "Молоток",
    price: 25000 as unknown as Product["price"],
    categoryId: 2,
    remaining: 5,
    createdAt: new Date("2024-01-02"),
    updatedAt: new Date("2024-01-02"),
    category: { id: 2, name: "Молотки", parentId: 1, parent: { id: 1, name: "Инструменты" } },
};

const defaultParams = {
    page: 1,
    limit: 20,
    searchQuery: "",
};

describe("PublicProducts Service", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeEach(() => {
        mockLogger = createMockLogger();
    });

    describe("getAllProducts", () => {
        test("should return paginated products list with count", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([2, [mockProduct, mockProduct2]]);

            // Act
            const result = await PublicProductsService.getAllProducts(defaultParams, mockLogger);

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; products: unknown[] };
            expect(data.count).toBe(2);
            expect(data.products).toHaveLength(2);
        });

        test("should convert Decimal price to Number", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([1, [mockProduct]]);

            // Act
            const result = await PublicProductsService.getAllProducts(defaultParams, mockLogger);

            // Assert
            const success = expectSuccess(result);
            const products = (success.data as { products: { price: number }[] }).products;
            expect(products[0].price).toBe(15000);
        });

        test("should return empty list when no products match", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([0, []]);

            // Act
            const result = await PublicProductsService.getAllProducts(defaultParams, mockLogger);

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; products: unknown[] };
            expect(data.count).toBe(0);
            expect(data.products).toHaveLength(0);
        });

        test("should filter by search query", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([1, [mockProduct]]);

            // Act
            const result = await PublicProductsService.getAllProducts(
                { ...defaultParams, searchQuery: "Отвертка" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; products: { name: string }[] };
            expect(data.count).toBe(1);
            expect(data.products[0].name).toBe("Отвертка");
        });

        test("should filter by category IDs with hierarchical descendants", async () => {
            // Arrange — category 1 has child category 2, which has no children
            prismaMock.category.findMany
                .mockResolvedValueOnce([{ id: 2 }] as unknown as Category[])
                .mockResolvedValueOnce([] as Category[]);
            prismaMock.$transaction.mockResolvedValueOnce([1, [mockProduct]]);

            // Act
            const result = await PublicProductsService.getAllProducts(
                { ...defaultParams, categoryIds: "1" },
                mockLogger,
            );

            // Assert
            expectSuccess(result);
            // getCategoryWithDescendants recursed: category 1 → found child 2 → child 2 has no children
            expect(prismaMock.category.findMany).toHaveBeenCalledTimes(2);
        });

        test("should handle deep category hierarchy (3+ levels)", async () => {
            // Arrange — category 1 → 2 → 3 (three levels)
            prismaMock.category.findMany
                .mockResolvedValueOnce([{ id: 2 }] as unknown as Category[])   // children of 1
                .mockResolvedValueOnce([{ id: 3 }] as unknown as Category[])   // children of 2
                .mockResolvedValueOnce([] as Category[]);                       // children of 3
            prismaMock.$transaction.mockResolvedValueOnce([1, [mockProduct]]);

            // Act
            const result = await PublicProductsService.getAllProducts(
                { ...defaultParams, categoryIds: "1" },
                mockLogger,
            );

            // Assert
            expectSuccess(result);
            // Recursive: 1 → children(1)=[2] → children(2)=[3] → children(3)=[]
            expect(prismaMock.category.findMany).toHaveBeenCalledTimes(3);
        });

        test("should handle multiple category IDs in comma-separated string", async () => {
            // Arrange — two root categories, no children
            prismaMock.category.findMany
                .mockResolvedValueOnce([] as Category[])
                .mockResolvedValueOnce([] as Category[]);
            prismaMock.$transaction.mockResolvedValueOnce([2, [mockProduct, mockProduct2]]);

            // Act
            const result = await PublicProductsService.getAllProducts(
                { ...defaultParams, categoryIds: "1,2" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; products: unknown[] };
            expect(data.count).toBe(2);
        });

        test("should filter by minimum price", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([1, [mockProduct2]]);

            // Act
            const result = await PublicProductsService.getAllProducts(
                { ...defaultParams, minPrice: 20000 },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; products: { price: number }[] };
            expect(data.count).toBe(1);
            expect(data.products[0].price).toBe(25000);
        });

        test("should filter by maximum price", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([1, [mockProduct]]);

            // Act
            const result = await PublicProductsService.getAllProducts(
                { ...defaultParams, maxPrice: 20000 },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; products: { price: number }[] };
            expect(data.count).toBe(1);
            expect(data.products[0].price).toBe(15000);
        });

        test("should filter by price range (min and max)", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([1, [mockProduct]]);

            // Act
            const result = await PublicProductsService.getAllProducts(
                { ...defaultParams, minPrice: 10000, maxPrice: 20000 },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number };
            expect(data.count).toBe(1);
        });

        test("should apply combined filters (search + category + price)", async () => {
            // Arrange — category 1, no children
            prismaMock.category.findMany.mockResolvedValueOnce([] as Category[]);
            prismaMock.$transaction.mockResolvedValueOnce([1, [mockProduct]]);

            // Act
            const result = await PublicProductsService.getAllProducts(
                { ...defaultParams, searchQuery: "Отвертка", categoryIds: "1", minPrice: 10000, maxPrice: 20000 },
                mockLogger,
            );

            // Assert
            expectSuccess(result);
        });

        test("should handle database error gracefully", async () => {
            // Arrange
            prismaMock.$transaction.mockRejectedValueOnce(new Error("DB connection failed"));

            // Act
            const result = await PublicProductsService.getAllProducts(defaultParams, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBeInstanceOf(Error);
            expect(mockLogger.error).toHaveBeenCalledWith(
                "Products: Error in getAllProducts",
                expect.objectContaining({ page: 1, limit: 20 }),
            );
        });

        test("should handle invalid categoryIds string gracefully", async () => {
            // Arrange — "abc" parsed as NaN, filtered out by .filter(n => !isNaN(n))
            prismaMock.$transaction.mockResolvedValueOnce([0, []]);

            // Act
            const result = await PublicProductsService.getAllProducts(
                { ...defaultParams, categoryIds: "abc" },
                mockLogger,
            );

            // Assert
            expectSuccess(result);
        });

        test("should handle empty categoryIds string", async () => {
            // Arrange — empty string splits into [""] which maps to NaN, filtered out
            prismaMock.$transaction.mockResolvedValueOnce([0, []]);

            // Act
            const result = await PublicProductsService.getAllProducts(
                { ...defaultParams, categoryIds: "" },
                mockLogger,
            );

            // Assert
            expectSuccess(result);
        });
    });

    describe("getProduct", () => {
        test("should return single product by id", async () => {
            // Arrange
            prismaMock.product.findFirst.mockResolvedValueOnce(mockProduct as unknown as Product);

            // Act
            const result = await PublicProductsService.getProduct(1, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toHaveProperty("id", 1);
            expect(success.data).toHaveProperty("name", "Отвертка");
        });

        test("should convert Decimal price to Number", async () => {
            // Arrange
            prismaMock.product.findFirst.mockResolvedValueOnce(mockProduct as unknown as Product);

            // Act
            const result = await PublicProductsService.getProduct(1, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect((success.data as { price: number }).price).toBe(15000);
        });

        test("should include category with parent relation in response", async () => {
            // Arrange
            prismaMock.product.findFirst.mockResolvedValueOnce(mockProduct2 as unknown as Product);

            // Act
            const result = await PublicProductsService.getProduct(2, mockLogger);

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { category: { name: string; parent: { name: string } | null } };
            expect(data.category.name).toBe("Молотки");
            expect(data.category.parent?.name).toBe("Инструменты");
        });

        test("should return failure when product not found", async () => {
            // Arrange
            prismaMock.product.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await PublicProductsService.getProduct(999, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Product not found");
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "Products: Product not found",
                expect.objectContaining({ productId: 999 }),
            );
        });

        test("should handle database error gracefully", async () => {
            // Arrange
            const dbError = new Error("DB error");
            prismaMock.product.findFirst.mockRejectedValueOnce(dbError);

            // Act
            const result = await PublicProductsService.getProduct(1, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBeInstanceOf(Error);
            expect(mockLogger.error).toHaveBeenCalledWith(
                "Products: Error in getProduct",
                expect.objectContaining({ productId: 1, error: dbError }),
            );
        });

        test("should handle zero id", async () => {
            // Arrange
            prismaMock.product.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await PublicProductsService.getProduct(0, mockLogger);

            // Assert
            expectFailure(result);
        });

        test("should handle negative id", async () => {
            // Arrange
            prismaMock.product.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await PublicProductsService.getProduct(-1, mockLogger);

            // Assert
            expectFailure(result);
        });
    });
});
