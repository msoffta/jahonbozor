import { describe, test, expect, beforeEach, spyOn } from "bun:test";
import { Elysia } from "elysia";
import { createMockLogger } from "@backend/test/setup";
import { PublicCategoriesService } from "../categories.service";

const mockCategories = [
    {
        id: 1,
        name: "Отвертки",
        children: [
            { id: 2, name: "Крестовые" },
            { id: 3, name: "Плоские" },
        ],
    },
    {
        id: 4,
        name: "Дрели",
        children: [],
    },
];

const mockCategory = {
    id: 1,
    name: "Отвертки",
    parentId: null,
    parent: null,
    children: [
        { id: 2, name: "Крестовые" },
        { id: 3, name: "Плоские" },
    ],
};

const createTestApp = () => {
    const mockLogger = createMockLogger();

    return new Elysia()
        .derive(() => ({
            logger: mockLogger,
            requestId: "test-request-id",
        }))
        .get("/categories", async ({ logger }) => {
            return await PublicCategoriesService.getAllCategories(logger);
        })
        .get("/categories/:id", async ({ params, logger }) => {
            const id = Number(params.id);
            const result = await PublicCategoriesService.getCategory(id, logger);
            return result;
        });
};

describe("PublicCategories Endpoints", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    describe("GET /categories", () => {
        test("should return categories list", async () => {
            // Arrange
            const spy = spyOn(PublicCategoriesService, "getAllCategories").mockResolvedValueOnce({
                success: true,
                data: { categories: mockCategories },
            });

            // Act
            const response = await app.handle(new Request("http://localhost/categories"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.categories).toHaveLength(2);

            spy.mockRestore();
        });

        test("should handle service error", async () => {
            // Arrange
            const spy = spyOn(PublicCategoriesService, "getAllCategories").mockResolvedValueOnce({
                success: false,
                error: "DB error",
            });

            // Act
            const response = await app.handle(new Request("http://localhost/categories"));
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);

            spy.mockRestore();
        });
    });

    describe("GET /categories/:id", () => {
        test("should return single category", async () => {
            // Arrange
            const spy = spyOn(PublicCategoriesService, "getCategory").mockResolvedValueOnce({
                success: true,
                data: mockCategory,
            });

            // Act
            const response = await app.handle(new Request("http://localhost/categories/1"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.name).toBe("Отвертки");

            spy.mockRestore();
        });

        test("should return failure when category not found", async () => {
            // Arrange
            const spy = spyOn(PublicCategoriesService, "getCategory").mockResolvedValueOnce({
                success: false,
                error: "Category not found",
            });

            // Act
            const response = await app.handle(new Request("http://localhost/categories/999"));
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);

            spy.mockRestore();
        });
    });
});
