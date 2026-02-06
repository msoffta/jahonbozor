import { describe, test, expect, beforeEach, spyOn } from "bun:test";
import { Elysia } from "elysia";
import { createMockLogger } from "@test/setup";
import { Permission } from "@jahonbozor/schemas";
import { ProductsService } from "../products.service";
import { HistoryService } from "../history/history.service";

// Mock product data
const mockProduct = {
    id: 1,
    name: "Test Product",
    price: 100,
    costprice: 50,
    categoryId: 1,
    remaining: 10,
    deletedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    category: {
        id: 1,
        name: "Electronics",
        parent: null,
    },
};

const mockProductHistory = {
    id: 1,
    productId: 1,
    staffId: 1,
    operation: "CREATE",
    quantity: null,
    previousData: null,
    newData: { name: "Test Product", price: 100 },
    changeReason: null,
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
                Permission.PRODUCTS_LIST,
                Permission.PRODUCTS_READ,
                Permission.PRODUCTS_CREATE,
                Permission.PRODUCTS_UPDATE,
                Permission.PRODUCTS_DELETE,
                Permission.PRODUCT_HISTORY_LIST,
                Permission.PRODUCT_HISTORY_CREATE,
            ],
            logger: mockLogger,
            requestId: "test-request-id",
        }))
        .get("/products", async ({ query, logger }) => {
            return await ProductsService.getAllProducts(
                {
                    page: Number(query.page) || 1,
                    limit: Number(query.limit) || 20,
                    searchQuery: query.searchQuery,
                    categoryId: query.categoryId ? Number(query.categoryId) : undefined,
                    minPrice: query.minPrice ? Number(query.minPrice) : undefined,
                    maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
                    includeDeleted: query.includeDeleted === "true",
                },
                logger,
            );
        })
        .get("/products/:id", async ({ params, logger }) => {
            return await ProductsService.getProduct(Number(params.id), logger);
        })
        .post("/products", async ({ body, logger, requestId }) => {
            const productData = body as { name: string; price: number; costprice: number; categoryId: number; remaining?: number };
            return await ProductsService.createProduct(
                { ...productData, remaining: productData.remaining ?? 0 },
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        })
        .patch("/products/:id", async ({ params, body, logger, requestId }) => {
            return await ProductsService.updateProduct(
                Number(params.id),
                body as { name?: string; price?: number; costprice?: number; categoryId?: number },
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        })
        .delete("/products/:id", async ({ params, logger, requestId }) => {
            return await ProductsService.deleteProduct(
                Number(params.id),
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        })
        .post("/products/:id/restore", async ({ params, logger, requestId }) => {
            return await ProductsService.restoreProduct(
                Number(params.id),
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        })
        .get("/products/:id/history", async ({ params, query, logger }) => {
            return await HistoryService.getProductHistory(
                Number(params.id),
                {
                    page: Number(query.page) || 1,
                    limit: Number(query.limit) || 20,
                    searchQuery: query.searchQuery,
                },
                logger,
            );
        })
        .post("/products/:id/inventory", async ({ params, body, logger, requestId }) => {
            return await HistoryService.createInventoryAdjustment(
                Number(params.id),
                body as { operation: "INVENTORY_ADD" | "INVENTORY_REMOVE"; quantity: number; changeReason: string | null },
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        });
};

describe("Products API Routes", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    describe("GET /products", () => {
        test("should return paginated products list", async () => {
            // Arrange
            const spy = spyOn(ProductsService, "getAllProducts").mockResolvedValue({
                success: true,
                data: { count: 2, products: [mockProduct] },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/products?page=1&limit=20"),
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
            const spy = spyOn(ProductsService, "getAllProducts").mockResolvedValue({
                success: true,
                data: { count: 1, products: [mockProduct] },
            });

            // Act
            await app.handle(
                new Request("http://localhost/products?searchQuery=Test"),
            );

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ searchQuery: "Test" }),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should apply categoryId filter", async () => {
            // Arrange
            const spy = spyOn(ProductsService, "getAllProducts").mockResolvedValue({
                success: true,
                data: { count: 1, products: [mockProduct] },
            });

            // Act
            await app.handle(
                new Request("http://localhost/products?categoryId=1"),
            );

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ categoryId: 1 }),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should apply price range filter", async () => {
            // Arrange
            const spy = spyOn(ProductsService, "getAllProducts").mockResolvedValue({
                success: true,
                data: { count: 0, products: [] },
            });

            // Act
            await app.handle(
                new Request("http://localhost/products?minPrice=50&maxPrice=150"),
            );

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ minPrice: 50, maxPrice: 150 }),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should include deleted products when requested", async () => {
            // Arrange
            const spy = spyOn(ProductsService, "getAllProducts").mockResolvedValue({
                success: true,
                data: { count: 1, products: [{ ...mockProduct, deletedAt: new Date() }] },
            });

            // Act
            await app.handle(
                new Request("http://localhost/products?includeDeleted=true"),
            );

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ includeDeleted: true }),
                expect.anything(),
            );

            spy.mockRestore();
        });
    });

    describe("GET /products/:id", () => {
        test("should return product by id", async () => {
            // Arrange
            const spy = spyOn(ProductsService, "getProduct").mockResolvedValue({
                success: true,
                data: mockProduct,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/products/1"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.id).toBe(1);

            spy.mockRestore();
        });

        test("should return error when product not found", async () => {
            // Arrange
            const spy = spyOn(ProductsService, "getProduct").mockResolvedValue({
                success: false,
                error: "Product not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/products/999"),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Product not found");

            spy.mockRestore();
        });
    });

    describe("POST /products", () => {
        test("should create product with valid data", async () => {
            // Arrange
            const spy = spyOn(ProductsService, "createProduct").mockResolvedValue({
                success: true,
                data: mockProduct,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/products", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: "Test Product",
                        price: 100,
                        costprice: 50,
                        categoryId: 1,
                    }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.name).toBe("Test Product");

            spy.mockRestore();
        });

        test("should return error when category not found", async () => {
            // Arrange
            const spy = spyOn(ProductsService, "createProduct").mockResolvedValue({
                success: false,
                error: "Category not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/products", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: "Test Product",
                        price: 100,
                        costprice: 50,
                        categoryId: 999,
                    }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Category not found");

            spy.mockRestore();
        });

        test("should pass context to service", async () => {
            // Arrange
            const spy = spyOn(ProductsService, "createProduct").mockResolvedValue({
                success: true,
                data: mockProduct,
            });

            // Act
            await app.handle(
                new Request("http://localhost/products", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: "Test Product",
                        price: 100,
                        costprice: 50,
                        categoryId: 1,
                    }),
                }),
            );

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ name: "Test Product" }),
                expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
                expect.anything(),
            );

            spy.mockRestore();
        });
    });

    describe("PATCH /products/:id", () => {
        test("should update product", async () => {
            // Arrange
            const updatedProduct = { ...mockProduct, name: "Updated Name" };
            const spy = spyOn(ProductsService, "updateProduct").mockResolvedValue({
                success: true,
                data: updatedProduct,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/products/1", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "Updated Name" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.name).toBe("Updated Name");

            spy.mockRestore();
        });

        test("should return error when product not found", async () => {
            // Arrange
            const spy = spyOn(ProductsService, "updateProduct").mockResolvedValue({
                success: false,
                error: "Product not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/products/999", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "New Name" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Product not found");

            spy.mockRestore();
        });

        test("should return error when updating deleted product", async () => {
            // Arrange
            const spy = spyOn(ProductsService, "updateProduct").mockResolvedValue({
                success: false,
                error: "Cannot update deleted product",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/products/1", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "New Name" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Cannot update deleted product");

            spy.mockRestore();
        });
    });

    describe("DELETE /products/:id", () => {
        test("should soft delete product", async () => {
            // Arrange
            const deletedProduct = { ...mockProduct, deletedAt: new Date() };
            const spy = spyOn(ProductsService, "deleteProduct").mockResolvedValue({
                success: true,
                data: deletedProduct,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/products/1", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);

            spy.mockRestore();
        });

        test("should return error when product not found", async () => {
            // Arrange
            const spy = spyOn(ProductsService, "deleteProduct").mockResolvedValue({
                success: false,
                error: "Product not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/products/999", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Product not found");

            spy.mockRestore();
        });

        test("should return error when product already deleted", async () => {
            // Arrange
            const spy = spyOn(ProductsService, "deleteProduct").mockResolvedValue({
                success: false,
                error: "Product already deleted",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/products/1", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Product already deleted");

            spy.mockRestore();
        });
    });

    describe("POST /products/:id/restore", () => {
        test("should restore deleted product", async () => {
            // Arrange
            const restoredProduct = { ...mockProduct, deletedAt: null };
            const spy = spyOn(ProductsService, "restoreProduct").mockResolvedValue({
                success: true,
                data: restoredProduct,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/products/1/restore", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);

            spy.mockRestore();
        });

        test("should return error when product not found", async () => {
            // Arrange
            const spy = spyOn(ProductsService, "restoreProduct").mockResolvedValue({
                success: false,
                error: "Product not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/products/999/restore", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Product not found");

            spy.mockRestore();
        });

        test("should return error when product is not deleted", async () => {
            // Arrange
            const spy = spyOn(ProductsService, "restoreProduct").mockResolvedValue({
                success: false,
                error: "Product is not deleted",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/products/1/restore", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Product is not deleted");

            spy.mockRestore();
        });
    });

    describe("GET /products/:id/history", () => {
        test("should return product history", async () => {
            // Arrange
            const spy = spyOn(HistoryService, "getProductHistory").mockResolvedValue({
                success: true,
                data: { count: 1, history: [mockProductHistory] },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/products/1/history"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(1);

            spy.mockRestore();
        });

        test("should apply pagination", async () => {
            // Arrange
            const spy = spyOn(HistoryService, "getProductHistory").mockResolvedValue({
                success: true,
                data: { count: 0, history: [] },
            });

            // Act
            await app.handle(
                new Request("http://localhost/products/1/history?page=2&limit=10"),
            );

            // Assert
            expect(spy).toHaveBeenCalledWith(
                1,
                expect.objectContaining({ page: 2, limit: 10 }),
                expect.anything(),
            );

            spy.mockRestore();
        });
    });

    describe("POST /products/:id/inventory", () => {
        test("should add inventory", async () => {
            // Arrange
            const spy = spyOn(HistoryService, "createInventoryAdjustment").mockResolvedValue({
                success: true,
                data: {
                    product: { ...mockProduct, remaining: 15 },
                    history: { ...mockProductHistory, operation: "INVENTORY_ADD", quantity: 5 },
                },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/products/1/inventory", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        operation: "INVENTORY_ADD",
                        quantity: 5,
                        changeReason: null,
                    }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.product.remaining).toBe(15);

            spy.mockRestore();
        });

        test("should remove inventory", async () => {
            // Arrange
            const spy = spyOn(HistoryService, "createInventoryAdjustment").mockResolvedValue({
                success: true,
                data: {
                    product: { ...mockProduct, remaining: 5 },
                    history: { ...mockProductHistory, operation: "INVENTORY_REMOVE", quantity: 5 },
                },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/products/1/inventory", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        operation: "INVENTORY_REMOVE",
                        quantity: 5,
                        changeReason: null,
                    }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.product.remaining).toBe(5);

            spy.mockRestore();
        });

        test("should return error for insufficient stock", async () => {
            // Arrange
            const spy = spyOn(HistoryService, "createInventoryAdjustment").mockResolvedValue({
                success: false,
                error: "Insufficient stock",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/products/1/inventory", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        operation: "INVENTORY_REMOVE",
                        quantity: 100,
                        changeReason: null,
                    }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Insufficient stock");

            spy.mockRestore();
        });

        test("should pass context to service", async () => {
            // Arrange
            const spy = spyOn(HistoryService, "createInventoryAdjustment").mockResolvedValue({
                success: true,
                data: {
                    product: mockProduct,
                    history: mockProductHistory,
                },
            });

            // Act
            await app.handle(
                new Request("http://localhost/products/1/inventory", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        operation: "INVENTORY_ADD",
                        quantity: 5,
                        changeReason: "Restock",
                    }),
                }),
            );

            // Assert
            expect(spy).toHaveBeenCalledWith(
                1,
                expect.objectContaining({ operation: "INVENTORY_ADD", quantity: 5 }),
                expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
                expect.anything(),
            );

            spy.mockRestore();
        });
    });
});
