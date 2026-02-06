import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { Elysia } from "elysia";
import { prismaMock, createMockLogger } from "@test/setup";
import type { Category } from "@generated/prisma/client";
import { Permission } from "@jahonbozor/schemas";
import { CategoriesService } from "../categories.service";

// Mock data
const mockCategory: Category = {
    id: 1,
    name: "Electronics",
    parentId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

const mockChildCategory: Category = {
    id: 5,
    name: "Smartphones",
    parentId: 1,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

const mockUser = {
    id: 1,
    type: "staff" as const,
    fullname: "Test Admin",
    username: "testadmin",
    telegramId: "123456789",
    roleId: 1,
};

const allCategoryPermissions = [
    Permission.CATEGORIES_LIST,
    Permission.CATEGORIES_READ,
    Permission.CATEGORIES_CREATE,
    Permission.CATEGORIES_UPDATE,
    Permission.CATEGORIES_DELETE,
];

/**
 * Creates a test Elysia app that mirrors the categories router structure.
 * Uses mocked middleware context instead of real authMiddleware.
 *
 * Note: This duplicates routing logic from categories.index.ts intentionally -
 * Elysia macros (authMiddleware) cannot be easily mocked via mock.module()
 * because they use runtime plugins. Using spyOn(CategoriesService) allows
 * testing route-to-service integration without full middleware stack.
 */
const createTestApp = () => {
    const mockLogger = createMockLogger();

    return new Elysia()
        .derive(() => ({
            user: mockUser,
            permissions: allCategoryPermissions,
            logger: mockLogger,
            requestId: "test-request-id",
        }))
        .get("/categories", async ({ query, logger }) => {
            return await CategoriesService.getAllCategories(
                {
                    page: Number(query.page) || 1,
                    limit: Number(query.limit) || 20,
                    searchQuery: query.searchQuery,
                    parentId: query.parentId === "null" ? null : query.parentId ? Number(query.parentId) : undefined,
                    includeChildren: query.includeChildren === "true",
                    includeProducts: query.includeProducts === "true",
                    includeParent: query.includeParent === "true",
                    depth: Number(query.depth) || 1,
                },
                logger,
            );
        })
        .get("/categories/tree", async ({ query, logger }) => {
            const depth = Number(query.depth) || 3;
            return await CategoriesService.getCategoryTree(depth, logger);
        })
        .get("/categories/:id", async ({ params, query, logger }) => {
            return await CategoriesService.getCategory(
                Number(params.id),
                query.includeChildren === "true",
                query.includeProducts === "true",
                query.includeParent === "true",
                Number(query.depth) || 1,
                logger,
            );
        })
        .post("/categories", async ({ body, logger, requestId }) => {
            return await CategoriesService.createCategory(
                body as { name: string; parentId?: number | null },
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        })
        .patch("/categories/:id", async ({ params, body, logger, requestId }) => {
            return await CategoriesService.updateCategory(
                Number(params.id),
                body as { name?: string; parentId?: number | null },
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        })
        .delete("/categories/:id", async ({ params, logger, requestId }) => {
            return await CategoriesService.deleteCategory(
                Number(params.id),
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        });
};

describe("Categories API Routes", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    describe("GET /categories", () => {
        test("should return paginated categories list", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([2, [mockCategory, mockChildCategory]]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories?page=1&limit=20"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(2);
            expect(body.data.categories).toHaveLength(2);
        });

        test("should filter by parentId=null for root categories", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([1, [mockCategory]]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories?parentId=null"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
        });

        test("should filter by specific parentId", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([1, [mockChildCategory]]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories?parentId=1"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
        });

        test("should apply search query filter", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([1, [mockCategory]]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories?searchQuery=Electr"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
        });

        test("should return empty list when no categories found", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([0, []]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(0);
            expect(body.data.categories).toHaveLength(0);
        });
    });

    describe("GET /categories/tree", () => {
        test("should return category tree", async () => {
            // Arrange
            const mockTree = [
                { ...mockCategory, children: [{ ...mockChildCategory, children: [] }] },
            ];
            prismaMock.category.findMany.mockResolvedValueOnce(mockTree);

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories/tree"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data).toHaveLength(1);
            expect(body.data[0].children).toHaveLength(1);
        });

        test("should accept depth parameter", async () => {
            // Arrange
            prismaMock.category.findMany.mockResolvedValueOnce([mockCategory]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories/tree?depth=5"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
        });
    });

    describe("GET /categories/:id", () => {
        test("should return category by id", async () => {
            // Arrange
            prismaMock.category.findUnique.mockResolvedValueOnce(mockCategory);

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories/1"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.id).toBe(1);
            expect(body.data.name).toBe("Electronics");
        });

        test("should return error when category not found", async () => {
            // Arrange
            prismaMock.category.findUnique.mockResolvedValueOnce(null);

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories/999"),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Category not found");
        });

        test("should include children when requested", async () => {
            // Arrange
            const categoryWithChildren = {
                ...mockCategory,
                children: [mockChildCategory],
            };
            prismaMock.category.findUnique.mockResolvedValueOnce(categoryWithChildren);

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories/1?includeChildren=true"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.children).toHaveLength(1);
        });
    });

    describe("POST /categories", () => {
        test("should create root category", async () => {
            // Arrange
            prismaMock.category.findFirst.mockResolvedValueOnce(null);
            prismaMock.$transaction.mockImplementationOnce(async (callback) => {
                const mockTx = {
                    category: { create: mock(() => Promise.resolve(mockCategory)) },
                    auditLog: { create: mock(() => Promise.resolve({})) },
                };
                return (callback as (tx: unknown) => Promise<unknown>)(mockTx);
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "Electronics" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.name).toBe("Electronics");
        });

        test("should create child category", async () => {
            // Arrange
            prismaMock.category.findUnique.mockResolvedValueOnce(mockCategory); // Parent exists
            prismaMock.category.findFirst.mockResolvedValueOnce(null); // No duplicate
            prismaMock.$transaction.mockImplementationOnce(async (callback) => {
                const mockTx = {
                    category: { create: mock(() => Promise.resolve(mockChildCategory)) },
                    auditLog: { create: mock(() => Promise.resolve({})) },
                };
                return (callback as (tx: unknown) => Promise<unknown>)(mockTx);
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "Smartphones", parentId: 1 }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.parentId).toBe(1);
        });

        test("should return error when parent not found", async () => {
            // Arrange
            prismaMock.category.findUnique.mockResolvedValueOnce(null); // Parent doesn't exist

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "Smartphones", parentId: 999 }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Parent category not found");
        });

        test("should return error when name already exists at same level", async () => {
            // Arrange
            prismaMock.category.findFirst.mockResolvedValueOnce(mockCategory); // Duplicate exists

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "Electronics" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Category name already exists at this level");
        });
    });

    describe("PATCH /categories/:id", () => {
        test("should update category name", async () => {
            // Arrange
            const updatedCategory = { ...mockCategory, name: "Gadgets" };
            prismaMock.category.findUnique.mockResolvedValueOnce(mockCategory); // Exists
            prismaMock.category.findFirst.mockResolvedValueOnce(null); // No duplicate
            prismaMock.$transaction.mockImplementationOnce(async (callback) => {
                const mockTx = {
                    category: { update: mock(() => Promise.resolve(updatedCategory)) },
                    auditLog: { create: mock(() => Promise.resolve({})) },
                };
                return (callback as (tx: unknown) => Promise<unknown>)(mockTx);
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories/1", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "Gadgets" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.name).toBe("Gadgets");
        });

        test("should return error when category not found", async () => {
            // Arrange
            prismaMock.category.findUnique.mockResolvedValueOnce(null);

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories/999", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "New Name" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Category not found");
        });

        test("should prevent setting category as its own parent", async () => {
            // Arrange
            prismaMock.category.findUnique.mockResolvedValueOnce(mockCategory);

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories/1", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ parentId: 1 }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Cannot set category as its own parent");
        });
    });

    describe("DELETE /categories/:id", () => {
        test("should delete category without children or products", async () => {
            // Arrange
            prismaMock.category.findUnique.mockResolvedValueOnce(mockCategory);
            prismaMock.category.count.mockResolvedValueOnce(0); // No children
            prismaMock.product.count.mockResolvedValueOnce(0); // No products
            prismaMock.$transaction.mockImplementationOnce(async (callback) => {
                const mockTx = {
                    category: { delete: mock(() => Promise.resolve(mockCategory)) },
                    auditLog: { create: mock(() => Promise.resolve({})) },
                };
                return (callback as (tx: unknown) => Promise<unknown>)(mockTx);
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories/1", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
        });

        test("should return error when category not found", async () => {
            // Arrange
            prismaMock.category.findUnique.mockResolvedValueOnce(null);

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories/999", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Category not found");
        });

        test("should return error when category has children", async () => {
            // Arrange
            prismaMock.category.findUnique.mockResolvedValueOnce(mockCategory);
            prismaMock.category.count.mockResolvedValueOnce(3); // Has children

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories/1", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Cannot delete category with child categories");
        });

        test("should return error when category has products", async () => {
            // Arrange
            prismaMock.category.findUnique.mockResolvedValueOnce(mockCategory);
            prismaMock.category.count.mockResolvedValueOnce(0); // No children
            prismaMock.product.count.mockResolvedValueOnce(5); // Has products

            // Act
            const response = await app.handle(
                new Request("http://localhost/categories/1", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Cannot delete category with products");
        });
    });
});

describe("Categories Service Integration", () => {
    test("getAllCategories should be called with correct pagination", async () => {
        // Arrange
        const spy = spyOn(CategoriesService, "getAllCategories").mockResolvedValue({
            success: true,
            data: { count: 0, categories: [] },
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/categories?page=3&limit=15"));

        // Assert
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ page: 3, limit: 15 }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("getCategory should be called with correct parameters", async () => {
        // Arrange
        const spy = spyOn(CategoriesService, "getCategory").mockResolvedValue({
            success: true,
            data: mockCategory,
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/categories/5?includeChildren=true&depth=3"));

        // Assert
        expect(spy).toHaveBeenCalledWith(5, true, false, false, 3, expect.anything());

        spy.mockRestore();
    });

    test("createCategory should be called with context", async () => {
        // Arrange
        const spy = spyOn(CategoriesService, "createCategory").mockResolvedValue({
            success: true,
            data: mockCategory,
        });
        const app = createTestApp();

        // Act
        await app.handle(
            new Request("http://localhost/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "Test" }),
            }),
        );

        // Assert
        expect(spy).toHaveBeenCalledWith(
            { name: "Test" },
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("deleteCategory should be called with context", async () => {
        // Arrange
        const spy = spyOn(CategoriesService, "deleteCategory").mockResolvedValue({
            success: true,
            data: mockCategory,
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/categories/1", { method: "DELETE" }));

        // Assert
        expect(spy).toHaveBeenCalledWith(
            1,
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.anything(),
        );

        spy.mockRestore();
    });
});
