import { Prisma } from "@backend/generated/prisma/client";
import { auditInTransaction } from "@backend/lib/audit";
import { prisma } from "@backend/lib/prisma";
import { createBroadcastTemplateSnapshot } from "@backend/lib/snapshots";

import type { ServiceContext } from "@backend/lib/audit";
import type { Logger } from "@jahonbozor/logger";
import type {
    BroadcastTemplateDetailResponse,
    BroadcastTemplatesListResponse,
    BroadcastTemplatesPagination,
    CreateBroadcastTemplateBody,
    UpdateBroadcastTemplateBody,
} from "@jahonbozor/schemas/src/broadcast-templates";

export abstract class BroadcastTemplatesService {
    static async getAllTemplates(
        params: BroadcastTemplatesPagination,
        logger: Logger,
    ): Promise<BroadcastTemplatesListResponse> {
        try {
            const { page, limit, sortBy, sortOrder, searchQuery, includeDeleted } = params;

            const whereClause: Prisma.BroadcastTemplateWhereInput = {};

            if (!includeDeleted) {
                whereClause.deletedAt = null;
            }

            if (searchQuery) {
                whereClause.name = { contains: searchQuery, mode: "insensitive" };
            }

            const [count, templates] = await prisma.$transaction([
                prisma.broadcastTemplate.count({ where: whereClause }),
                prisma.broadcastTemplate.findMany({
                    skip: (page - 1) * limit,
                    take: limit,
                    where: whereClause,
                    orderBy: { [sortBy]: sortOrder },
                }),
            ]);

            return {
                success: true,
                data: { count, templates },
            };
        } catch (error) {
            logger.error("BroadcastTemplates: Error in getAllTemplates", { params, error });
            return { success: false, error };
        }
    }

    static async getTemplate(
        templateId: number,
        logger: Logger,
    ): Promise<BroadcastTemplateDetailResponse> {
        try {
            const template = await prisma.broadcastTemplate.findFirst({
                where: { id: templateId, deletedAt: null },
            });

            if (!template) {
                logger.warn("BroadcastTemplates: Template not found", { templateId });
                return { success: false, error: "Template not found" };
            }

            return { success: true, data: template };
        } catch (error) {
            logger.error("BroadcastTemplates: Error in getTemplate", { templateId, error });
            return { success: false, error };
        }
    }

    static async createTemplate(
        body: CreateBroadcastTemplateBody,
        context: ServiceContext,
        logger: Logger,
    ): Promise<BroadcastTemplateDetailResponse> {
        try {
            // Check for duplicate name
            const existingTemplate = await prisma.broadcastTemplate.findFirst({
                where: { name: body.name, deletedAt: null },
            });

            if (existingTemplate) {
                logger.warn("BroadcastTemplates: Template name already exists", {
                    name: body.name,
                });
                return { success: false, error: "Template name already exists" };
            }

            const [newTemplate] = await prisma.$transaction(async (transaction) => {
                const template = await transaction.broadcastTemplate.create({
                    data: {
                        name: body.name,
                        content: body.content,
                        ...(body.media !== undefined && {
                            media: body.media ?? Prisma.DbNull,
                        }),
                        ...(body.buttons !== undefined && {
                            buttons: body.buttons ?? Prisma.DbNull,
                        }),
                    },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "broadcastTemplate",
                        entityId: template.id,
                        action: "CREATE",
                        newData: createBroadcastTemplateSnapshot(template),
                    },
                );

                return [template];
            });

            logger.info("BroadcastTemplates: Template created", {
                templateId: newTemplate.id,
                name: body.name,
                staffId: context.staffId,
            });

            return { success: true, data: newTemplate };
        } catch (error) {
            logger.error("BroadcastTemplates: Error in createTemplate", { body, error });
            return { success: false, error };
        }
    }

    static async updateTemplate(
        templateId: number,
        body: UpdateBroadcastTemplateBody,
        context: ServiceContext,
        logger: Logger,
    ): Promise<BroadcastTemplateDetailResponse> {
        try {
            const existingTemplate = await prisma.broadcastTemplate.findFirst({
                where: { id: templateId, deletedAt: null },
            });

            if (!existingTemplate) {
                logger.warn("BroadcastTemplates: Template not found for update", { templateId });
                return { success: false, error: "Template not found" };
            }

            // Check for duplicate name if name is being changed
            if (body.name && body.name !== existingTemplate.name) {
                const duplicateName = await prisma.broadcastTemplate.findFirst({
                    where: {
                        name: body.name,
                        deletedAt: null,
                        id: { not: templateId },
                    },
                });

                if (duplicateName) {
                    logger.warn("BroadcastTemplates: Template name already exists", {
                        templateId,
                        name: body.name,
                    });
                    return { success: false, error: "Template name already exists" };
                }
            }

            const [updatedTemplate] = await prisma.$transaction(async (transaction) => {
                const data: Prisma.BroadcastTemplateUpdateInput = {
                    ...(body.name !== undefined && { name: body.name }),
                    ...(body.content !== undefined && { content: body.content }),
                    ...(body.media !== undefined && {
                        media: body.media ?? Prisma.DbNull,
                    }),
                    ...(body.buttons !== undefined && {
                        buttons: body.buttons ?? Prisma.DbNull,
                    }),
                };

                const template = await transaction.broadcastTemplate.update({
                    where: { id: templateId },
                    data,
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "broadcastTemplate",
                        entityId: templateId,
                        action: "UPDATE",
                        previousData: createBroadcastTemplateSnapshot(existingTemplate),
                        newData: createBroadcastTemplateSnapshot(template),
                    },
                );

                return [template];
            });

            logger.info("BroadcastTemplates: Template updated", {
                templateId,
                staffId: context.staffId,
            });

            return { success: true, data: updatedTemplate };
        } catch (error) {
            logger.error("BroadcastTemplates: Error in updateTemplate", { templateId, error });
            return { success: false, error };
        }
    }

    static async deleteTemplate(
        templateId: number,
        context: ServiceContext,
        logger: Logger,
    ): Promise<BroadcastTemplateDetailResponse> {
        try {
            const existingTemplate = await prisma.broadcastTemplate.findFirst({
                where: { id: templateId, deletedAt: null },
            });

            if (!existingTemplate) {
                logger.warn("BroadcastTemplates: Template not found for delete", { templateId });
                return { success: false, error: "Template not found" };
            }

            const [deletedTemplate] = await prisma.$transaction(async (transaction) => {
                const template = await transaction.broadcastTemplate.update({
                    where: { id: templateId },
                    data: { deletedAt: new Date() },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "broadcastTemplate",
                        entityId: templateId,
                        action: "DELETE",
                        previousData: createBroadcastTemplateSnapshot(existingTemplate),
                    },
                );

                return [template];
            });

            logger.info("BroadcastTemplates: Template deleted", {
                templateId,
                name: deletedTemplate.name,
                staffId: context.staffId,
            });

            return { success: true, data: deletedTemplate };
        } catch (error) {
            logger.error("BroadcastTemplates: Error in deleteTemplate", { templateId, error });
            return { success: false, error };
        }
    }

    static async restoreTemplate(
        templateId: number,
        context: ServiceContext,
        logger: Logger,
    ): Promise<BroadcastTemplateDetailResponse> {
        try {
            const deletedTemplate = await prisma.broadcastTemplate.findFirst({
                where: { id: templateId, deletedAt: { not: null } },
            });

            if (!deletedTemplate) {
                logger.warn("BroadcastTemplates: Deleted template not found for restore", {
                    templateId,
                });
                return { success: false, error: "Deleted template not found" };
            }

            const [restoredTemplate] = await prisma.$transaction(async (transaction) => {
                const template = await transaction.broadcastTemplate.update({
                    where: { id: templateId },
                    data: { deletedAt: null },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "broadcastTemplate",
                        entityId: templateId,
                        action: "RESTORE",
                        previousData: createBroadcastTemplateSnapshot(deletedTemplate),
                        newData: createBroadcastTemplateSnapshot(template),
                    },
                );

                return [template];
            });

            logger.info("BroadcastTemplates: Template restored", {
                templateId,
                name: restoredTemplate.name,
                staffId: context.staffId,
            });

            return { success: true, data: restoredTemplate };
        } catch (error) {
            logger.error("BroadcastTemplates: Error in restoreTemplate", { templateId, error });
            return { success: false, error };
        }
    }
}
