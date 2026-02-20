import { describe, test, expect, beforeEach, mock } from "bun:test";
import { prismaMock, createMockLogger, expectSuccess, expectFailure } from "@backend/test/setup";
import { CategoriesService } from "../categories.service";
import type { Category } from "@backend/generated/prisma/client";

describe("CategoriesService", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    // Factory for creating mock category with required fields
    const createMockCategory = (overrides: Partial<Category> & { id: number; name: string }): Category => ({
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    });

    // Mock staff user for audit context
    const mockUser = {
        id: 1,
        type: "staff" as const,
        fullname: "Test Staff",
        username: "teststaff",
        telegramId: "123456789",
        roleId: 1,
    };

    // Factory for creating mock audit context
    const createMockContext = () => ({
        staffId: 1,
        user: mockUser,
        requestId: "test-request-id",
    });

    beforeEach(() => {
        mockLogger = createMockLogger();
    });

    describe("getAllCategories", () => {
        test("should return paginated categories", async () => {
            // Arrange
            const mockCategories = [
                createMockCategory({ id: 1, name: "Electronics" }),
                createMockCategory({ id: 2, name: "Clothing" }),
            ];
            prismaMock.$transaction.mockResolvedValueOnce([2, mockCategories]);

            // Act
            const result = await CategoriesService.getAllCategories(
                { page: 1, limit: 10, searchQuery: "", depth: 1 },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; categories: Category[] };
            expect(data.count).toBe(2);
            expect(data.categories).toHaveLength(2);
        });

        test("should filter by parentId=null for root categories", async () => {
            // Arrange
            const mockCategories = [
                createMockCategory({ id: 1, name: "Electronics" }),
            ];
            prismaMock.$transaction.mockResolvedValueOnce([1, mockCategories]);

            // Act
            const result = await CategoriesService.getAllCategories(
                { page: 1, limit: 10, searchQuery: "", parentId: null, depth: 1 },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; categories: Category[] };
            expect(data.categories).toHaveLength(1);
        });

        test("should filter by specific parentId", async () => {
            // Arrange
            const mockCategories = [
                createMockCategory({ id: 5, name: "Smartphones", parentId: 1 }),
            ];
            prismaMock.$transaction.mockResolvedValueOnce([1, mockCategories]);

            // Act
            const result = await CategoriesService.getAllCategories(
                { page: 1, limit: 10, searchQuery: "", parentId: 1, depth: 1 },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; categories: Category[] };
            expect(data.categories).toHaveLength(1);
            expect(data.categories[0].parentId).toBe(1);
        });

        test("should search by name", async () => {
            // Arrange
            const mockCategories = [
                createMockCategory({ id: 1, name: "Electronics" }),
            ];
            prismaMock.$transaction.mockResolvedValueOnce([1, mockCategories]);

            // Act
            const result = await CategoriesService.getAllCategories(
                { page: 1, limit: 10, searchQuery: "Electr", depth: 1 },
                mockLogger,
            );

            // Assert
            expectSuccess(result);
        });
    });

    describe("getCategory", () => {
        test("should return category by id", async () => {
            // Arrange
            const mockCategory = createMockCategory({ id: 1, name: "Electronics" });
            prismaMock.category.findUnique.mockResolvedValueOnce(mockCategory);

            // Act
            const result = await CategoriesService.getCategory(1, false, false, false, 1, mockLogger);

            // Assert
            const success = expectSuccess(result);
            const data = success.data as Category;
            expect(data.id).toBe(1);
            expect(data.name).toBe("Electronics");
        });

        test("should return error when category not found", async () => {
            // Arrange
            prismaMock.category.findUnique.mockResolvedValueOnce(null);

            // Act
            const result = await CategoriesService.getCategory(999, false, false, false, 1, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Category not found");
        });

        test("should include children when requested", async () => {
            // Arrange
            const mockCategory = {
                ...createMockCategory({ id: 1, name: "Electronics" }),
                children: [createMockCategory({ id: 5, name: "Smartphones", parentId: 1 })],
            };
            prismaMock.category.findUnique.mockResolvedValueOnce(mockCategory);

            // Act
            const result = await CategoriesService.getCategory(1, true, false, false, 1, mockLogger);

            // Assert
            const success = expectSuccess(result);
            const data = success.data as Category & { children: Category[] };
            expect(data.children).toHaveLength(1);
        });
    });

    describe("createCategory", () => {
        test("should create root category", async () => {
            // Arrange
            const mockCategory = createMockCategory({ id: 1, name: "Electronics" });
            prismaMock.category.findFirst.mockResolvedValueOnce(null);
            prismaMock.$transaction.mockImplementationOnce(async (callback: any) => {
                const mockTransaction = {
                    category: { create: mock(() => Promise.resolve(mockCategory)) },
                    auditLog: { create: mock(() => Promise.resolve({})) },
                };
                return callback(mockTransaction);
            });

            // Act
            const result = await CategoriesService.createCategory(
                { name: "Electronics" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as Category;
            expect(data.name).toBe("Electronics");
            expect(data.parentId).toBeNull();
        });

        test("should create child category with valid parentId", async () => {
            // Arrange
            const mockParent = createMockCategory({ id: 1, name: "Electronics" });
            const mockCategory = createMockCategory({ id: 5, name: "Smartphones", parentId: 1 });
            prismaMock.category.findUnique.mockResolvedValueOnce(mockParent);
            prismaMock.category.findFirst.mockResolvedValueOnce(null);
            prismaMock.$transaction.mockImplementationOnce(async (callback: any) => {
                const mockTransaction = {
                    category: { create: mock(() => Promise.resolve(mockCategory)) },
                    auditLog: { create: mock(() => Promise.resolve({})) },
                };
                return callback(mockTransaction);
            });

            // Act
            const result = await CategoriesService.createCategory(
                { name: "Smartphones", parentId: 1 },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as Category;
            expect(data.parentId).toBe(1);
        });

        test("should return error when parent not found", async () => {
            // Arrange
            prismaMock.category.findUnique.mockResolvedValueOnce(null);

            // Act
            const result = await CategoriesService.createCategory(
                { name: "Smartphones", parentId: 999 },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Parent category not found");
        });

        test("should return error when name already exists at same level", async () => {
            // Arrange
            prismaMock.category.findFirst.mockResolvedValueOnce(
                createMockCategory({ id: 1, name: "Electronics" }),
            );

            // Act
            const result = await CategoriesService.createCategory(
                { name: "Electronics" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Category name already exists at this level");
        });
    });

    describe("updateCategory", () => {
        test("should update category name", async () => {
            // Arrange
            const existingCategory = createMockCategory({ id: 1, name: "Electronics" });
            const updatedCategory = createMockCategory({ id: 1, name: "Gadgets" });
            prismaMock.category.findUnique.mockResolvedValueOnce(existingCategory);
            prismaMock.category.findFirst.mockResolvedValueOnce(null);
            prismaMock.$transaction.mockImplementationOnce(async (callback: any) => {
                const mockTransaction = {
                    category: { update: mock(() => Promise.resolve(updatedCategory)) },
                    auditLog: { create: mock(() => Promise.resolve({})) },
                };
                return callback(mockTransaction);
            });

            // Act
            const result = await CategoriesService.updateCategory(
                1,
                { name: "Gadgets" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as Category;
            expect(data.name).toBe("Gadgets");
        });

        test("should return error when category not found", async () => {
            // Arrange
            prismaMock.category.findUnique.mockResolvedValueOnce(null);

            // Act
            const result = await CategoriesService.updateCategory(
                999,
                { name: "New Name" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Category not found");
        });

        test("should prevent setting category as its own parent", async () => {
            // Arrange
            const existingCategory = createMockCategory({ id: 1, name: "Electronics" });
            prismaMock.category.findUnique.mockResolvedValueOnce(existingCategory);

            // Act
            const result = await CategoriesService.updateCategory(
                1,
                { parentId: 1 },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Cannot set category as its own parent");
        });

        test("should return error when parent not found", async () => {
            // Arrange
            const existingCategory = createMockCategory({ id: 1, name: "Electronics" });
            prismaMock.category.findUnique
                .mockResolvedValueOnce(existingCategory)
                .mockResolvedValueOnce(null);

            // Act
            const result = await CategoriesService.updateCategory(
                1,
                { parentId: 999 },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Parent category not found");
        });
    });

    describe("deleteCategory", () => {
        test("should delete category without children or products", async () => {
            // Arrange
            const mockCategory = createMockCategory({ id: 1, name: "Electronics" });
            prismaMock.category.findUnique.mockResolvedValueOnce(mockCategory);
            prismaMock.category.count.mockResolvedValueOnce(0);
            prismaMock.product.count.mockResolvedValueOnce(0);
            prismaMock.$transaction.mockImplementationOnce(async (callback: any) => {
                const mockTransaction = {
                    category: { delete: mock(() => Promise.resolve(mockCategory)) },
                    auditLog: { create: mock(() => Promise.resolve({})) },
                };
                return callback(mockTransaction);
            });

            // Act
            const result = await CategoriesService.deleteCategory(1, createMockContext(), mockLogger);

            // Assert
            expectSuccess(result);
        });

        test("should return error when category not found", async () => {
            // Arrange
            prismaMock.category.findUnique.mockResolvedValueOnce(null);

            // Act
            const result = await CategoriesService.deleteCategory(999, createMockContext(), mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Category not found");
        });

        test("should return error when category has children", async () => {
            // Arrange
            const mockCategory = createMockCategory({ id: 1, name: "Electronics" });
            prismaMock.category.findUnique.mockResolvedValueOnce(mockCategory);
            prismaMock.category.count.mockResolvedValueOnce(3);

            // Act
            const result = await CategoriesService.deleteCategory(1, createMockContext(), mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Cannot delete category with child categories");
        });

        test("should return error when category has products", async () => {
            // Arrange
            const mockCategory = createMockCategory({ id: 1, name: "Electronics" });
            prismaMock.category.findUnique.mockResolvedValueOnce(mockCategory);
            prismaMock.category.count.mockResolvedValueOnce(0);
            prismaMock.product.count.mockResolvedValueOnce(5);

            // Act
            const result = await CategoriesService.deleteCategory(1, createMockContext(), mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Cannot delete category with products");
        });
    });

    describe("getCategoryTree", () => {
        test("should return category tree", async () => {
            // Arrange
            const mockTree = [
                {
                    ...createMockCategory({ id: 1, name: "Electronics" }),
                    children: [
                        { ...createMockCategory({ id: 5, name: "Smartphones", parentId: 1 }), children: [] },
                    ],
                },
            ];
            prismaMock.category.findMany.mockResolvedValueOnce(mockTree);

            // Act
            const result = await CategoriesService.getCategoryTree(3, mockLogger);

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { categories: Array<Category & { children: Category[] }> };
            expect(data.categories).toHaveLength(1);
            expect(data.categories[0].children).toHaveLength(1);
        });
    });

    describe("edge cases", () => {
        test("getCategory with id=0 should return not found", async () => {
            prismaMock.category.findUnique.mockResolvedValueOnce(null);

            const result = await CategoriesService.getCategory(0, false, false, false, 1, mockLogger);

            const failure = expectFailure(result);
            expect(failure.error).toBe("Category not found");
        });

        test("getCategory with negative id should return not found", async () => {
            prismaMock.category.findUnique.mockResolvedValueOnce(null);

            const result = await CategoriesService.getCategory(-1, false, false, false, 1, mockLogger);

            const failure = expectFailure(result);
            expect(failure.error).toBe("Category not found");
        });

        test("createCategory with non-existent parentId should return error", async () => {
            prismaMock.category.findUnique.mockResolvedValueOnce(null);

            const result = await CategoriesService.createCategory(
                { name: "Test", parentId: 999 },
                createMockContext(),
                mockLogger,
            );

            const failure = expectFailure(result);
            expect(failure.error).toBe("Parent category not found");
        });

        test("deleteCategory with id=0 should return not found", async () => {
            prismaMock.category.findUnique.mockResolvedValueOnce(null);

            const result = await CategoriesService.deleteCategory(0, createMockContext(), mockLogger);

            const failure = expectFailure(result);
            expect(failure.error).toBe("Category not found");
        });

        test("getCategoryTree should return empty array when no categories", async () => {
            prismaMock.category.findMany.mockResolvedValueOnce([]);

            const result = await CategoriesService.getCategoryTree(3, mockLogger);

            const success = expectSuccess(result);
            const data = success.data as { categories: unknown[] };
            expect(data.categories).toEqual([]);
        });
    });
});
