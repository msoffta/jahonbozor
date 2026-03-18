import { Elysia, t } from "elysia";

import { Permission } from "@jahonbozor/schemas";
import { AuditLogPagination } from "@jahonbozor/schemas/src/audit-logs";

import { authMiddleware } from "@backend/lib/middleware";

import { AuditLogService } from "./audit-logs.service";

import type {
    AuditLogDetailResponse,
    AuditLogsListResponse,
} from "@jahonbozor/schemas/src/audit-logs";

const auditLogIdParams = t.Object({
    id: t.Numeric(),
});

const entityParams = t.Object({
    entityType: t.String(),
    entityId: t.Numeric(),
});

const requestIdParams = t.Object({
    requestId: t.String(),
});

export const auditLogs = new Elysia({ prefix: "/audit-logs" })
    .use(authMiddleware)
    .get(
        "/",
        async ({ query, set, logger }): Promise<AuditLogsListResponse> => {
            try {
                return await AuditLogService.getAll(query, logger);
            } catch (error) {
                logger.error("AuditLog: Unhandled error in GET /audit-logs", {
                    error,
                });
                set.status = 500;
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.AUDIT_LOGS_LIST],
            query: AuditLogPagination,
        },
    )
    .get(
        "/:id",
        async ({ params, set, logger }): Promise<AuditLogDetailResponse> => {
            try {
                const result = await AuditLogService.getById(params.id, logger);

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error("AuditLog: Unhandled error in GET /audit-logs/:id", {
                    id: params.id,
                    error,
                });
                set.status = 500;
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.AUDIT_LOGS_READ],
            params: auditLogIdParams,
        },
    )
    .get(
        "/by-request/:requestId",
        async ({ params, set, logger }): Promise<AuditLogsListResponse> => {
            try {
                return await AuditLogService.getByRequestId(params.requestId, logger);
            } catch (error) {
                logger.error("AuditLog: Unhandled error in GET /audit-logs/by-request/:requestId", {
                    requestId: params.requestId,
                    error,
                });
                set.status = 500;
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.AUDIT_LOGS_READ],
            params: requestIdParams,
        },
    )
    .get(
        "/by-entity/:entityType/:entityId",
        async ({ params, set, logger }): Promise<AuditLogsListResponse> => {
            try {
                return await AuditLogService.getByEntity(
                    params.entityType,
                    params.entityId,
                    logger,
                );
            } catch (error) {
                logger.error(
                    "AuditLog: Unhandled error in GET /audit-logs/by-entity/:entityType/:entityId",
                    {
                        entityType: params.entityType,
                        entityId: params.entityId,
                        error,
                    },
                );
                set.status = 500;
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.AUDIT_LOGS_READ],
            params: entityParams,
        },
    );
