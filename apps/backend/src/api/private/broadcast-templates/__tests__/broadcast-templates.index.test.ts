import { Elysia } from "elysia";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { Permission } from "@jahonbozor/schemas";

import { createMockLogger, prismaMock } from "@backend/test/setup";

import { BroadcastTemplatesService } from "../broadcast-templates.service";

import type { BroadcastTemplate } from "@backend/generated/prisma/client";
import type {
    CreateBroadcastTemplateBody,
    UpdateBroadcastTemplateBody,
} from "@jahonbozor/schemas/src/broadcast-templates";

// Mock data
const mockTemplate: BroadcastTemplate = {
    id: 1,
    name: "Welcome Template",
    content: "<b>Hello</b> World",
    media: null,
    buttons: null,
    deletedAt: null,
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

const allPermissions = [
    Permission.BROADCAST_TEMPLATES_LIST,
    Permission.BROADCAST_TEMPLATES_READ,
    Permission.BROADCAST_TEMPLATES_CREATE,
    Permission.BROADCAST_TEMPLATES_UPDATE,
    Permission.BROADCAST_TEMPLATES_DELETE,
];

/**
 * Creates a test Elysia app that mirrors the broadcast-templates router structure.
 * Uses mocked middleware context instead of real authMiddleware.
 *
 * Note: This duplicates routing logic from broadcast-templates.index.ts intentionally -
 * Elysia macros (authMiddleware) cannot be easily mocked via vi.fn()
 * because they use runtime plugins. Using spyOn(BroadcastTemplatesService) allows
 * testing route-to-service integration without full middleware stack.
 */
const createTestApp = () => {
    const mockLogger = createMockLogger();

    return new Elysia()
        .derive(() => ({
            user: mockUser,
            permissions: allPermissions,
            logger: mockLogger,
            requestId: "test-request-id",
        }))
        .get("/broadcast-templates", async ({ query, logger }) => {
            return await BroadcastTemplatesService.getAllTemplates(
                {
                    page: Number(query.page) || 1,
                    limit: Number(query.limit) || 20,
                    sortBy: query.sortBy || "id",
                    sortOrder: (query.sortOrder as "asc" | "desc") || "asc",
                    searchQuery: query.searchQuery || "",
                    includeDeleted: query.includeDeleted === "true",
                },
                logger,
            );
        })
        .get("/broadcast-templates/:id", async ({ params, set, logger }) => {
            const result = await BroadcastTemplatesService.getTemplate(Number(params.id), logger);
            if (!result.success) {
                set.status = 404;
            }
            return result;
        })
        .post("/broadcast-templates", async ({ body, logger, requestId }) => {
            return await BroadcastTemplatesService.createTemplate(
                body as CreateBroadcastTemplateBody,
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        })
        .patch("/broadcast-templates/:id", async ({ params, body, logger, requestId }) => {
            return await BroadcastTemplatesService.updateTemplate(
                Number(params.id),
                body as UpdateBroadcastTemplateBody,
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        })
        .delete("/broadcast-templates/:id", async ({ params, logger, requestId }) => {
            return await BroadcastTemplatesService.deleteTemplate(
                Number(params.id),
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        })
        .post("/broadcast-templates/:id/restore", async ({ params, logger, requestId }) => {
            return await BroadcastTemplatesService.restoreTemplate(
                Number(params.id),
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        });
};

describe("Broadcast Templates API Routes", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    describe("GET /broadcast-templates", () => {
        test("should return paginated templates list", async () => {
            // Arrange
            const templates = [mockTemplate, { ...mockTemplate, id: 2, name: "Promo Template" }];
            prismaMock.$transaction.mockResolvedValueOnce([2, templates]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcast-templates?page=1&limit=20"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(2);
            expect(body.data.templates).toHaveLength(2);
        });

        test("should return empty list when no templates exist", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([0, []]);

            // Act
            const response = await app.handle(new Request("http://localhost/broadcast-templates"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(0);
            expect(body.data.templates).toHaveLength(0);
        });
    });

    describe("GET /broadcast-templates/:id", () => {
        test("should return template by id", async () => {
            // Arrange
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(mockTemplate);

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcast-templates/1"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.id).toBe(1);
            expect(body.data.name).toBe("Welcome Template");
        });

        test("should return 404 when template not found", async () => {
            // Arrange
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null);

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcast-templates/999"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(404);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Template not found");
        });
    });

    describe("POST /broadcast-templates", () => {
        test("should create template successfully", async () => {
            // Arrange
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null); // No duplicate
            prismaMock.$transaction.mockImplementationOnce(async (callback) => {
                const mockTx = {
                    broadcastTemplate: {
                        create: vi.fn(() => Promise.resolve(mockTemplate)),
                    },
                    auditLog: { create: vi.fn(() => Promise.resolve({})) },
                };
                return (callback as (tx: unknown) => Promise<unknown>)(mockTx);
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcast-templates", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: "Welcome Template",
                        content: "<b>Hello</b> World",
                    }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.name).toBe("Welcome Template");
        });

        test("should return error on duplicate name", async () => {
            // Arrange
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(mockTemplate); // Duplicate exists

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcast-templates", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: "Welcome Template",
                        content: "<b>Hello</b>",
                    }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Template name already exists");
        });
    });

    describe("PATCH /broadcast-templates/:id", () => {
        test("should update template successfully", async () => {
            // Arrange
            const updatedTemplate = { ...mockTemplate, name: "Updated Template" };
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(mockTemplate); // Exists
            prismaMock.$transaction.mockImplementationOnce(async (callback) => {
                const mockTx = {
                    broadcastTemplate: {
                        update: vi.fn(() => Promise.resolve(updatedTemplate)),
                    },
                    auditLog: { create: vi.fn(() => Promise.resolve({})) },
                };
                return (callback as (tx: unknown) => Promise<unknown>)(mockTx);
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcast-templates/1", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "Updated Template" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.name).toBe("Updated Template");
        });

        test("should return error when template not found", async () => {
            // Arrange
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null);

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcast-templates/999", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "Updated" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Template not found");
        });
    });

    describe("DELETE /broadcast-templates/:id", () => {
        test("should soft delete template successfully", async () => {
            // Arrange
            const deletedTemplate = { ...mockTemplate, deletedAt: new Date() };
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(mockTemplate); // Exists
            prismaMock.$transaction.mockImplementationOnce(async (callback) => {
                const mockTx = {
                    broadcastTemplate: {
                        update: vi.fn(() => Promise.resolve(deletedTemplate)),
                    },
                    auditLog: { create: vi.fn(() => Promise.resolve({})) },
                };
                return (callback as (tx: unknown) => Promise<unknown>)(mockTx);
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcast-templates/1", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
        });

        test("should return error when template not found", async () => {
            // Arrange
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null);

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcast-templates/999", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Template not found");
        });
    });

    describe("POST /broadcast-templates/:id/restore", () => {
        test("should restore deleted template", async () => {
            // Arrange
            const deletedTemplate = { ...mockTemplate, deletedAt: new Date() };
            const restoredTemplate = { ...mockTemplate, deletedAt: null };
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(deletedTemplate); // Deleted exists
            prismaMock.$transaction.mockImplementationOnce(async (callback) => {
                const mockTx = {
                    broadcastTemplate: {
                        update: vi.fn(() => Promise.resolve(restoredTemplate)),
                    },
                    auditLog: { create: vi.fn(() => Promise.resolve({})) },
                };
                return (callback as (tx: unknown) => Promise<unknown>)(mockTx);
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcast-templates/1/restore", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
        });

        test("should return error when deleted template not found", async () => {
            // Arrange
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null);

            // Act
            const response = await app.handle(
                new Request("http://localhost/broadcast-templates/999/restore", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Deleted template not found");
        });
    });
});

describe("Broadcast Templates Service Integration", () => {
    test("getAllTemplates should be called with correct pagination", async () => {
        // Arrange
        const spy = vi.spyOn(BroadcastTemplatesService, "getAllTemplates").mockResolvedValue({
            success: true,
            data: { count: 0, templates: [] },
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/broadcast-templates?page=3&limit=15"));

        // Assert
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({
                page: 3,
                limit: 15,
            }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("getTemplate should be called with correct id", async () => {
        // Arrange
        const spy = vi.spyOn(BroadcastTemplatesService, "getTemplate").mockResolvedValue({
            success: true,
            data: mockTemplate,
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/broadcast-templates/5"));

        // Assert
        expect(spy).toHaveBeenCalledWith(5, expect.anything());

        spy.mockRestore();
    });

    test("createTemplate should be called with body and context", async () => {
        // Arrange
        const spy = vi.spyOn(BroadcastTemplatesService, "createTemplate").mockResolvedValue({
            success: true,
            data: mockTemplate,
        });
        const app = createTestApp();

        // Act
        await app.handle(
            new Request("http://localhost/broadcast-templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "Test", content: "Hello" }),
            }),
        );

        // Assert
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ name: "Test", content: "Hello" }),
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("updateTemplate should be called with id, body, and context", async () => {
        // Arrange
        const spy = vi.spyOn(BroadcastTemplatesService, "updateTemplate").mockResolvedValue({
            success: true,
            data: mockTemplate,
        });
        const app = createTestApp();

        // Act
        await app.handle(
            new Request("http://localhost/broadcast-templates/1", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "Updated" }),
            }),
        );

        // Assert
        expect(spy).toHaveBeenCalledWith(
            1,
            expect.objectContaining({ name: "Updated" }),
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("deleteTemplate should be called with id and context", async () => {
        // Arrange
        const spy = vi.spyOn(BroadcastTemplatesService, "deleteTemplate").mockResolvedValue({
            success: true,
            data: mockTemplate,
        });
        const app = createTestApp();

        // Act
        await app.handle(
            new Request("http://localhost/broadcast-templates/1", { method: "DELETE" }),
        );

        // Assert
        expect(spy).toHaveBeenCalledWith(
            1,
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("restoreTemplate should be called with id and context", async () => {
        // Arrange
        const spy = vi.spyOn(BroadcastTemplatesService, "restoreTemplate").mockResolvedValue({
            success: true,
            data: mockTemplate,
        });
        const app = createTestApp();

        // Act
        await app.handle(
            new Request("http://localhost/broadcast-templates/1/restore", { method: "POST" }),
        );

        // Assert
        expect(spy).toHaveBeenCalledWith(
            1,
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.anything(),
        );

        spy.mockRestore();
    });
});

describe("Broadcast Templates API edge cases", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    test("GET /broadcast-templates/:id with id=0 should return not found", async () => {
        // Arrange
        prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null);

        // Act
        const response = await app.handle(new Request("http://localhost/broadcast-templates/0"));
        const body = await response.json();

        // Assert
        expect(body.success).toBe(false);
        expect(body.error).toBe("Template not found");
    });

    test("DELETE /broadcast-templates/:id with already deleted template should return not found", async () => {
        // Arrange
        prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null);

        // Act
        const response = await app.handle(
            new Request("http://localhost/broadcast-templates/1", { method: "DELETE" }),
        );
        const body = await response.json();

        // Assert
        expect(body.success).toBe(false);
        expect(body.error).toBe("Template not found");
    });

    test("POST /broadcast-templates with duplicate name should return error", async () => {
        // Arrange
        prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(mockTemplate);

        // Act
        const response = await app.handle(
            new Request("http://localhost/broadcast-templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "Welcome Template",
                    content: "<b>Hello</b>",
                }),
            }),
        );
        const body = await response.json();

        // Assert
        expect(body.success).toBe(false);
        expect(body.error).toBe("Template name already exists");
    });

    test("POST /broadcast-templates/:id/restore with non-deleted template should return error", async () => {
        // Arrange
        prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null);

        // Act
        const response = await app.handle(
            new Request("http://localhost/broadcast-templates/1/restore", { method: "POST" }),
        );
        const body = await response.json();

        // Assert
        expect(body.success).toBe(false);
        expect(body.error).toBe("Deleted template not found");
    });
});
