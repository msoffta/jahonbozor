import { describe, test, expect, beforeEach, vi } from "vitest";
import { Elysia } from "elysia";
import { createMockLogger } from "@backend/test/setup";
import { PublicProductsService } from "../products.service";

const mockProducts = [
    {
        id: 1,
        name: "Отвертка",
        price: 15000,
        categoryId: 1,
        remaining: 10,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        category: { id: 1, name: "Инструменты", parent: null },
    },
    {
        id: 2,
        name: "Молоток",
        price: 25000,
        categoryId: 1,
        remaining: 5,
        createdAt: "2024-01-02T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
        category: { id: 1, name: "Инструменты", parent: null },
    },
];

const createTestApp = () => {
    const mockLogger = createMockLogger();

    return new Elysia()
        .derive(() => ({
            logger: mockLogger,
            requestId: "test-request-id",
        }))
        .get("/products", async ({ query, logger }) => {
            return await PublicProductsService.getAllProducts(
                {
                    page: Number(query.page) || 1,
                    limit: Number(query.limit) || 20,
                    searchQuery: query.searchQuery || "",
                    categoryIds: query.categoryIds || undefined,
                    minPrice: query.minPrice ? Number(query.minPrice) : undefined,
                    maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
                    includeDeleted: query.includeDeleted === "true",
                },
                logger,
            );
        })
        .get("/products/:id", async ({ params, set, logger }) => {
            const id = Number(params.id);
            const result = await PublicProductsService.getProduct(id, logger);

            if (!result.success) {
                set.status = 404;
            }

            return result;
        });
};

describe("PublicProducts Endpoints", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    describe("GET /products", () => {
        test("should return 200 with products list", async () => {
            // Arrange
            const spy = vi.spyOn(PublicProductsService, "getAllProducts").mockResolvedValueOnce({
                success: true,
                data: { count: 2, products: mockProducts },
            });

            // Act
            const response = await app.handle(new Request("http://localhost/products"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(2);
            expect(body.data.products).toHaveLength(2);

            spy.mockRestore();
        });

        test("should pass query parameters to service", async () => {
            // Arrange
            const spy = vi.spyOn(PublicProductsService, "getAllProducts").mockResolvedValueOnce({
                success: true,
                data: { count: 0, products: [] },
            });

            // Act
            const url = "http://localhost/products?page=2&limit=10&searchQuery=test";
            await app.handle(new Request(url));

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ page: 2, limit: 10, searchQuery: "test" }),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should handle service error", async () => {
            // Arrange
            const spy = vi.spyOn(PublicProductsService, "getAllProducts").mockResolvedValueOnce({
                success: false,
                error: "DB error",
            });

            // Act
            const response = await app.handle(new Request("http://localhost/products"));
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("DB error");

            spy.mockRestore();
        });

        test("should return empty list when no products found", async () => {
            // Arrange
            const spy = vi.spyOn(PublicProductsService, "getAllProducts").mockResolvedValueOnce({
                success: true,
                data: { count: 0, products: [] },
            });

            // Act
            const response = await app.handle(new Request("http://localhost/products"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.data.count).toBe(0);
            expect(body.data.products).toHaveLength(0);

            spy.mockRestore();
        });
    });

    describe("GET /products/:id", () => {
        test("should return 200 with product detail", async () => {
            // Arrange
            const spy = vi.spyOn(PublicProductsService, "getProduct").mockResolvedValueOnce({
                success: true,
                data: mockProducts[0],
            });

            // Act
            const response = await app.handle(new Request("http://localhost/products/1"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.name).toBe("Отвертка");
            expect(body.data.price).toBe(15000);

            spy.mockRestore();
        });

        test("should return 404 when product not found", async () => {
            // Arrange
            const spy = vi.spyOn(PublicProductsService, "getProduct").mockResolvedValueOnce({
                success: false,
                error: "Product not found",
            });

            // Act
            const response = await app.handle(new Request("http://localhost/products/999"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(404);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Product not found");

            spy.mockRestore();
        });

        test("should return 404 on service error", async () => {
            // Arrange — any failure sets 404 in the handler
            const spy = vi.spyOn(PublicProductsService, "getProduct").mockResolvedValueOnce({
                success: false,
                error: "DB error",
            });

            // Act
            const response = await app.handle(new Request("http://localhost/products/1"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(404);
            expect(body.success).toBe(false);

            spy.mockRestore();
        });

        test("should call getProduct with parsed numeric id", async () => {
            // Arrange
            const spy = vi.spyOn(PublicProductsService, "getProduct").mockResolvedValueOnce({
                success: true,
                data: mockProducts[0],
            });

            // Act
            await app.handle(new Request("http://localhost/products/42"));

            // Assert
            expect(spy).toHaveBeenCalledWith(42, expect.anything());

            spy.mockRestore();
        });

        test("should call getProduct with 0 when id param is 0", async () => {
            // Arrange
            const spy = vi.spyOn(PublicProductsService, "getProduct").mockResolvedValueOnce({
                success: false,
                error: "Product not found",
            });

            // Act
            const response = await app.handle(new Request("http://localhost/products/0"));

            // Assert
            expect(spy).toHaveBeenCalledWith(0, expect.anything());
            expect(response.status).toBe(404);

            spy.mockRestore();
        });

        test("should call getProduct with negative number when id is negative", async () => {
            // Arrange
            const spy = vi.spyOn(PublicProductsService, "getProduct").mockResolvedValueOnce({
                success: false,
                error: "Product not found",
            });

            // Act
            await app.handle(new Request("http://localhost/products/-5"));

            // Assert
            expect(spy).toHaveBeenCalledWith(-5, expect.anything());

            spy.mockRestore();
        });
    });

    describe("GET /products - filter params", () => {
        test("should pass filter params (categoryIds, minPrice, maxPrice) to service", async () => {
            // Arrange
            const spy = vi.spyOn(PublicProductsService, "getAllProducts").mockResolvedValueOnce({
                success: true,
                data: { count: 0, products: [] },
            });

            // Act
            const url = "http://localhost/products?categoryIds=1,2&minPrice=5000&maxPrice=50000";
            await app.handle(new Request(url));

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({
                    categoryIds: "1,2",
                    minPrice: 5000,
                    maxPrice: 50000,
                }),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should parse includeDeleted string 'true' to boolean true", async () => {
            // Arrange
            const spy = vi.spyOn(PublicProductsService, "getAllProducts").mockResolvedValueOnce({
                success: true,
                data: { count: 0, products: [] },
            });

            // Act
            const url = "http://localhost/products?includeDeleted=true";
            await app.handle(new Request(url));

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ includeDeleted: true }),
                expect.anything(),
            );

            spy.mockRestore();
        });
    });
});
