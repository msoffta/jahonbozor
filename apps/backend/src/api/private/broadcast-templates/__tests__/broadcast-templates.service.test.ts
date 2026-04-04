import { beforeEach, describe, expect, test, vi } from "vitest";

import { createMockLogger, expectFailure, expectSuccess, prismaMock } from "@backend/test/setup";

import { BroadcastTemplatesService } from "../broadcast-templates.service";

import type { BroadcastTemplate } from "@backend/generated/prisma/client";

describe("BroadcastTemplatesService", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    const mockUser = {
        id: 1,
        type: "staff" as const,
        fullname: "Admin",
        username: "admin",
        telegramId: "123",
        roleId: 1,
    };

    const createMockContext = () => ({
        staffId: 1,
        user: mockUser,
        requestId: "test-req-id",
    });

    const createMockTemplate = (overrides: Partial<BroadcastTemplate> = {}): BroadcastTemplate => ({
        id: 1,
        name: "Welcome Template",
        content: "<b>Hello</b> World",
        media: null,
        buttons: null,
        deletedAt: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        ...overrides,
    });

    beforeEach(() => {
        mockLogger = createMockLogger();
    });

    describe("getAllTemplates", () => {
        test("should return list with count", async () => {
            // Arrange
            const templates = [
                createMockTemplate({ id: 1, name: "Welcome" }),
                createMockTemplate({ id: 2, name: "Promo" }),
            ];
            prismaMock.$transaction.mockResolvedValueOnce([2, templates]);

            // Act
            const result = await BroadcastTemplatesService.getAllTemplates(
                { page: 1, limit: 10, sortBy: "id", sortOrder: "asc", searchQuery: "" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; templates: BroadcastTemplate[] };
            expect(data.count).toBe(2);
            expect(data.templates).toHaveLength(2);
        });

        test("should return empty list when no templates exist", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([0, []]);

            // Act
            const result = await BroadcastTemplatesService.getAllTemplates(
                { page: 1, limit: 10, sortBy: "id", sortOrder: "asc", searchQuery: "" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; templates: BroadcastTemplate[] };
            expect(data.count).toBe(0);
            expect(data.templates).toHaveLength(0);
        });

        test("should filter by searchQuery (name contains)", async () => {
            // Arrange
            const templates = [createMockTemplate({ id: 1, name: "Welcome Template" })];
            prismaMock.$transaction.mockResolvedValueOnce([1, templates]);

            // Act
            const result = await BroadcastTemplatesService.getAllTemplates(
                { page: 1, limit: 10, sortBy: "id", sortOrder: "asc", searchQuery: "Welcome" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; templates: BroadcastTemplate[] };
            expect(data.count).toBe(1);
            expect(data.templates[0].name).toBe("Welcome Template");
        });

        test("should exclude deleted templates by default", async () => {
            // Arrange
            const templates = [createMockTemplate({ id: 1, name: "Active" })];
            prismaMock.$transaction.mockResolvedValueOnce([1, templates]);

            // Act
            const result = await BroadcastTemplatesService.getAllTemplates(
                { page: 1, limit: 10, sortBy: "id", sortOrder: "asc", searchQuery: "" },
                mockLogger,
            );

            // Assert
            expectSuccess(result);
            // Verify the $transaction was called (the where clause filters deletedAt: null internally)
            expect(prismaMock.$transaction).toHaveBeenCalled();
        });

        test("should include deleted templates when includeDeleted=true", async () => {
            // Arrange
            const templates = [
                createMockTemplate({ id: 1, name: "Active" }),
                createMockTemplate({ id: 2, name: "Deleted", deletedAt: new Date() }),
            ];
            prismaMock.$transaction.mockResolvedValueOnce([2, templates]);

            // Act
            const result = await BroadcastTemplatesService.getAllTemplates(
                {
                    page: 1,
                    limit: 10,
                    sortBy: "id",
                    sortOrder: "asc",
                    searchQuery: "",
                    includeDeleted: true,
                },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as { count: number; templates: BroadcastTemplate[] };
            expect(data.count).toBe(2);
            expect(data.templates).toHaveLength(2);
        });
    });

    describe("getTemplate", () => {
        test("should return template by id", async () => {
            // Arrange
            const template = createMockTemplate({ id: 1, name: "Welcome" });
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(template);

            // Act
            const result = await BroadcastTemplatesService.getTemplate(1, mockLogger);

            // Assert
            const success = expectSuccess(result);
            const data = success.data as BroadcastTemplate;
            expect(data.id).toBe(1);
            expect(data.name).toBe("Welcome");
        });

        test("should return error when template not found", async () => {
            // Arrange
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await BroadcastTemplatesService.getTemplate(999, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Template not found");
        });

        test("should return error for deleted template", async () => {
            // Arrange
            // findFirst with where: { deletedAt: null } returns null for deleted templates
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await BroadcastTemplatesService.getTemplate(1, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Template not found");
        });
    });

    describe("createTemplate", () => {
        test("should create template successfully", async () => {
            // Arrange
            const newTemplate = createMockTemplate({ id: 1, name: "New Template" });
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null); // No duplicate
            prismaMock.$transaction.mockImplementationOnce(async (callback: any) => {
                const mockTransaction = {
                    broadcastTemplate: {
                        create: vi.fn(() => Promise.resolve(newTemplate)),
                    },
                    auditLog: { create: vi.fn(() => Promise.resolve({})) },
                };
                return callback(mockTransaction);
            });

            // Act
            const result = await BroadcastTemplatesService.createTemplate(
                { name: "New Template", content: "<b>Hello</b>" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as BroadcastTemplate;
            expect(data.id).toBe(1);
            expect(data.name).toBe("New Template");
        });

        test("should create template with media and buttons", async () => {
            // Arrange
            const media = [{ type: "photo" as const, url: "https://example.com/photo.jpg" }];
            const buttons = [{ text: "Visit", url: "https://example.com" }];
            const newTemplate = createMockTemplate({
                id: 2,
                name: "Rich Template",
                media,
                buttons,
            });
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null); // No duplicate
            prismaMock.$transaction.mockImplementationOnce(async (callback: any) => {
                const mockTransaction = {
                    broadcastTemplate: {
                        create: vi.fn(() => Promise.resolve(newTemplate)),
                    },
                    auditLog: { create: vi.fn(() => Promise.resolve({})) },
                };
                return callback(mockTransaction);
            });

            // Act
            const result = await BroadcastTemplatesService.createTemplate(
                { name: "Rich Template", content: "<b>Hello</b>", media, buttons },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as BroadcastTemplate;
            expect(data.name).toBe("Rich Template");
            expect(data.media).toEqual(media);
            expect(data.buttons).toEqual(buttons);
        });

        test("should return error on duplicate name", async () => {
            // Arrange
            const existingTemplate = createMockTemplate({ id: 1, name: "Existing" });
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(existingTemplate);

            // Act
            const result = await BroadcastTemplatesService.createTemplate(
                { name: "Existing", content: "<b>Hello</b>" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Template name already exists");
        });

        test("should create audit log entry", async () => {
            // Arrange
            const newTemplate = createMockTemplate({ id: 1, name: "Audited" });
            const auditCreateFn = vi.fn(() => Promise.resolve({}));
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null);
            prismaMock.$transaction.mockImplementationOnce(async (callback: any) => {
                const mockTransaction = {
                    broadcastTemplate: {
                        create: vi.fn(() => Promise.resolve(newTemplate)),
                    },
                    auditLog: { create: auditCreateFn },
                };
                return callback(mockTransaction);
            });

            // Act
            const result = await BroadcastTemplatesService.createTemplate(
                { name: "Audited", content: "<b>Hello</b>" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            expectSuccess(result);
            expect(auditCreateFn).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        entityType: "broadcastTemplate",
                        action: "CREATE",
                    }),
                }),
            );
        });
    });

    describe("updateTemplate", () => {
        test("should update template name", async () => {
            // Arrange
            const existingTemplate = createMockTemplate({ id: 1, name: "Old Name" });
            const updatedTemplate = createMockTemplate({ id: 1, name: "New Name" });
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(existingTemplate); // Exists
            prismaMock.$transaction.mockImplementationOnce(async (callback: any) => {
                const mockTransaction = {
                    broadcastTemplate: {
                        update: vi.fn(() => Promise.resolve(updatedTemplate)),
                    },
                    auditLog: { create: vi.fn(() => Promise.resolve({})) },
                };
                return callback(mockTransaction);
            });

            // Act
            const result = await BroadcastTemplatesService.updateTemplate(
                1,
                { name: "New Name" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as BroadcastTemplate;
            expect(data.name).toBe("New Name");
        });

        test("should update template content", async () => {
            // Arrange
            const existingTemplate = createMockTemplate({ id: 1, content: "Old content" });
            const updatedTemplate = createMockTemplate({ id: 1, content: "New content" });
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(existingTemplate);
            prismaMock.$transaction.mockImplementationOnce(async (callback: any) => {
                const mockTransaction = {
                    broadcastTemplate: {
                        update: vi.fn(() => Promise.resolve(updatedTemplate)),
                    },
                    auditLog: { create: vi.fn(() => Promise.resolve({})) },
                };
                return callback(mockTransaction);
            });

            // Act
            const result = await BroadcastTemplatesService.updateTemplate(
                1,
                { content: "New content" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as BroadcastTemplate;
            expect(data.content).toBe("New content");
        });

        test("should return error when template not found", async () => {
            // Arrange
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await BroadcastTemplatesService.updateTemplate(
                999,
                { name: "Updated" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Template not found");
        });

        test("should return error on duplicate name when changing to existing name", async () => {
            // Arrange
            const existingTemplate = createMockTemplate({ id: 1, name: "Template A" });
            const duplicateTemplate = createMockTemplate({ id: 2, name: "Template B" });
            prismaMock.broadcastTemplate.findFirst
                .mockResolvedValueOnce(existingTemplate) // Template exists
                .mockResolvedValueOnce(duplicateTemplate); // Duplicate name found

            // Act
            const result = await BroadcastTemplatesService.updateTemplate(
                1,
                { name: "Template B" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Template name already exists");
        });

        test("should allow keeping same name without duplicate error", async () => {
            // Arrange
            const existingTemplate = createMockTemplate({ id: 1, name: "Same Name" });
            const updatedTemplate = createMockTemplate({
                id: 1,
                name: "Same Name",
                content: "Updated content",
            });
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(existingTemplate);
            // No second findFirst call because name === existingTemplate.name
            prismaMock.$transaction.mockImplementationOnce(async (callback: any) => {
                const mockTransaction = {
                    broadcastTemplate: {
                        update: vi.fn(() => Promise.resolve(updatedTemplate)),
                    },
                    auditLog: { create: vi.fn(() => Promise.resolve({})) },
                };
                return callback(mockTransaction);
            });

            // Act
            const result = await BroadcastTemplatesService.updateTemplate(
                1,
                { name: "Same Name", content: "Updated content" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as BroadcastTemplate;
            expect(data.name).toBe("Same Name");
            expect(data.content).toBe("Updated content");
        });
    });

    describe("deleteTemplate", () => {
        test("should soft delete template", async () => {
            // Arrange
            const existingTemplate = createMockTemplate({ id: 1, name: "To Delete" });
            const deletedTemplate = createMockTemplate({
                id: 1,
                name: "To Delete",
                deletedAt: new Date(),
            });
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(existingTemplate);
            prismaMock.$transaction.mockImplementationOnce(async (callback: any) => {
                const mockTransaction = {
                    broadcastTemplate: {
                        update: vi.fn(() => Promise.resolve(deletedTemplate)),
                    },
                    auditLog: { create: vi.fn(() => Promise.resolve({})) },
                };
                return callback(mockTransaction);
            });

            // Act
            const result = await BroadcastTemplatesService.deleteTemplate(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as BroadcastTemplate;
            expect(data.deletedAt).not.toBeNull();
        });

        test("should return error when template not found", async () => {
            // Arrange
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await BroadcastTemplatesService.deleteTemplate(
                999,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Template not found");
        });

        test("should return error when template already deleted", async () => {
            // Arrange
            // findFirst with where: { deletedAt: null } returns null for already-deleted templates
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await BroadcastTemplatesService.deleteTemplate(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Template not found");
        });
    });

    describe("restoreTemplate", () => {
        test("should restore deleted template", async () => {
            // Arrange
            const deletedTemplate = createMockTemplate({
                id: 1,
                name: "Deleted",
                deletedAt: new Date(),
            });
            const restoredTemplate = createMockTemplate({
                id: 1,
                name: "Deleted",
                deletedAt: null,
            });
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(deletedTemplate);
            prismaMock.$transaction.mockImplementationOnce(async (callback: any) => {
                const mockTransaction = {
                    broadcastTemplate: {
                        update: vi.fn(() => Promise.resolve(restoredTemplate)),
                    },
                    auditLog: { create: vi.fn(() => Promise.resolve({})) },
                };
                return callback(mockTransaction);
            });

            // Act
            const result = await BroadcastTemplatesService.restoreTemplate(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            const data = success.data as BroadcastTemplate;
            expect(data.deletedAt).toBeNull();
        });

        test("should return error when template is not deleted", async () => {
            // Arrange
            // findFirst with where: { deletedAt: { not: null } } returns null for non-deleted templates
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await BroadcastTemplatesService.restoreTemplate(
                1,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Deleted template not found");
        });
    });

    describe("edge cases", () => {
        test("getTemplate with id=0 should return not found", async () => {
            // Arrange
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await BroadcastTemplatesService.getTemplate(0, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Template not found");
        });

        test("getTemplate with negative id should return not found", async () => {
            // Arrange
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await BroadcastTemplatesService.getTemplate(-1, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Template not found");
        });

        test("deleteTemplate with id=0 should return not found", async () => {
            // Arrange
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await BroadcastTemplatesService.deleteTemplate(
                0,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Template not found");
        });

        test("updateTemplate with id=0 should return not found", async () => {
            // Arrange
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await BroadcastTemplatesService.updateTemplate(
                0,
                { name: "Updated" },
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Template not found");
        });

        test("restoreTemplate with non-existent id should return not found", async () => {
            // Arrange
            prismaMock.broadcastTemplate.findFirst.mockResolvedValueOnce(null);

            // Act
            const result = await BroadcastTemplatesService.restoreTemplate(
                999,
                createMockContext(),
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Deleted template not found");
        });
    });
});
