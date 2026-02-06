import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import { AuditLogPagination } from "@jahonbozor/schemas/src/audit-logs";
import type { Logger } from "@jahonbozor/logger";
import { prisma } from "@lib/prisma";
import type { Prisma } from "@generated/prisma/client";

export abstract class AuditLogService {
    static async getAll(
        params: AuditLogPagination,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const {
                page,
                limit,
                entityType,
                entityId,
                actorId,
                actorType,
                action,
                dateFrom,
                dateTo,
                requestId,
            } = params;

            const whereClause: Prisma.AuditLogWhereInput = {
                ...(entityType && { entityType }),
                ...(entityId && { entityId }),
                ...(actorId && { actorId }),
                ...(actorType && { actorType }),
                ...(action && { action }),
                ...(requestId && { requestId }),
                ...(dateFrom || dateTo
                    ? {
                          createdAt: {
                              ...(dateFrom && { gte: dateFrom }),
                              ...(dateTo && { lte: dateTo }),
                          },
                      }
                    : {}),
            };

            const [count, auditLogs] = await prisma.$transaction([
                prisma.auditLog.count({ where: whereClause }),
                prisma.auditLog.findMany({
                    skip: (page - 1) * limit,
                    take: limit,
                    where: whereClause,
                    orderBy: { createdAt: "desc" },
                }),
            ]);

            return { success: true, data: { count, auditLogs } };
        } catch (error) {
            logger.error("AuditLog: Error in getAll", {
                page: params.page,
                limit: params.limit,
                error,
            });
            return { success: false, error };
        }
    }

    static async getById(
        auditLogId: number,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const auditLog = await prisma.auditLog.findUnique({
                where: { id: auditLogId },
            });

            if (!auditLog) {
                logger.warn("AuditLog: Entry not found", { auditLogId });
                return { success: false, error: "Audit log entry not found" };
            }

            return { success: true, data: auditLog };
        } catch (error) {
            logger.error("AuditLog: Error in getById", { auditLogId, error });
            return { success: false, error };
        }
    }

    static async getByRequestId(
        requestId: string,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const auditLogs = await prisma.auditLog.findMany({
                where: { requestId },
                orderBy: { createdAt: "asc" },
            });

            return { success: true, data: { count: auditLogs.length, auditLogs } };
        } catch (error) {
            logger.error("AuditLog: Error in getByRequestId", {
                requestId,
                error,
            });
            return { success: false, error };
        }
    }

    static async getByEntity(
        entityType: string,
        entityId: number,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const auditLogs = await prisma.auditLog.findMany({
                where: { entityType, entityId },
                orderBy: { createdAt: "desc" },
            });

            return { success: true, data: { count: auditLogs.length, auditLogs } };
        } catch (error) {
            logger.error("AuditLog: Error in getByEntity", {
                entityType,
                entityId,
                error,
            });
            return { success: false, error };
        }
    }
}
