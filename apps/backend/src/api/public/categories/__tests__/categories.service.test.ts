import { describe, test, expect, beforeEach } from "bun:test";
import { prismaMock, createMockLogger, expectSuccess, expectFailure } from "@backend/test/setup";
import type { Category } from "@backend/generated/prisma/client";
import { PublicCategoriesService } from "../categories.service";

const mockCategory: Category = {
    id: 1,
    name: "РћС‚РІРµСЂС‚РєРё",
    parentId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

const mockCategoryWithChildren = {
    ...mockCategory,
    children: [
        {
            id: 2,
            name: "РљСЂРµСЃС‚РѕРІС‹Рµ",
            parentId: 1,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
        },
        {
            id: 3,
            name: "РџР»РѕСЃРєРёРµ",
            parentId: 1,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
        },
    ],
};

describe("PublicCategories Service", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeEach(() => {
        mockLogger = createMockLogger();
    });

    describe("getAllCategories", () => {
        test("should return all root categories with children", async () => {
            // Arrange
            prismaMock.category.findMany.mockResolvedValueOnce([
                mockCategoryWithChildren,
            ] as unknown as Category[]);

            // Act
            const result = await PublicCategoriesService.getAllCategories(mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toHaveProperty("categories");
            expect((success.data as { categories: unknown[] }).categories).toHaveLength(1);
        });

        test("should return empty array when no categories exist", async () => {
            // Arrange
            prismaMock.category.findMany.mockResolvedValueOnce([]);

            // Act
            const result = await PublicCategoriesService.getAllCategories(mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect((success.data as { categories: unknown[] }).categories).toHaveLength(0);
        });

        test("should handle database error gracefully", async () => {
            // Arrange
            prismaMock.category.findMany.mockRejectedValueOnce(new Error("DB connection failed"));

            // Act
            const result = await PublicCategoriesService.getAllCategories(mockLogger);

            // Assert
            expectFailure(result);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("getCategory", () => {
        test("should return single category with children", async () => {
            // Arrange
            prismaMock.category.findFirst.mockResolvedValueOnce(
                mockCategoryWithChildren as unknown as Category,
            );

            // Act
            const result = await PublicCategoriesService.getCategory(1, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toHaveProperty("id", 1);
            expect(success.data).toHaveProperty("name", "РћС‚РІРµСЂС‚РєРё");
        });

        test("should return failure when category not found", async () => {
            // Arrange
            prismaMock.category.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await PublicCategoriesService.getCategory(999, mockLogger);

            // Assert
            expectFailure(result);
            expect(mockLogger.warn).toHaveBeenCalled();
        });

        test("should handle database error gracefully", async () => {
            // Arrange
            prismaMock.category.findFirst.mockRejectedValueOnce(new Error("DB error"));

            // Act
            const result = await PublicCategoriesService.getCategory(1, mockLogger);

            // Assert
            expectFailure(result);
            expect(mockLogger.error).toHaveBeenCalled();
        });

        test("should handle zero id", async () => {
            // Arrange
            prismaMock.category.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await PublicCategoriesService.getCategory(0, mockLogger);

            // Assert
            expectFailure(result);
        });

        test("should handle negative id", async () => {
            // Arrange
            prismaMock.category.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await PublicCategoriesService.getCategory(-1, mockLogger);

            // Assert
            expectFailure(result);
        });
    });
});
