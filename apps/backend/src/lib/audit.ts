import type { Logger } from "@jahonbozor/logger";
import type { Token } from "@jahonbozor/schemas";
import type {
    AuditAction as AuditActionType,
    ActorType as ActorTypeEnum,
} from "@generated/prisma/enums";
import type { Prisma } from "@generated/prisma/client";
import { prisma } from "@lib/prisma";

type TransactionClient = Prisma.TransactionClient;
type InputJsonValue = Prisma.InputJsonValue;

export interface AuditContext {
    requestId?: string;
    user?: Token;
    logger: Logger;
    ipAddress?: string;
    userAgent?: string;
}

interface AuditParams {
    entityType: string;
    entityId: number;
    action: AuditActionType;
    previousData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
}

function getActorType(user?: Token): ActorTypeEnum {
    if (!user) return "SYSTEM";
    return user.type === "staff" ? "STAFF" : "USER";
}

export async function auditInTransaction(
    transaction: TransactionClient,
    context: AuditContext,
    params: AuditParams,
): Promise<void> {
    const { requestId, user, logger, ipAddress, userAgent } = context;

    try {
        await transaction.auditLog.create({
            data: {
                requestId: requestId ?? null,
                actorId: user?.id ?? null,
                actorType: getActorType(user),
                entityType: params.entityType,
                entityId: params.entityId,
                action: params.action,
                previousData: params.previousData as InputJsonValue | undefined,
                newData: params.newData as InputJsonValue | undefined,
                metadata:
                    ipAddress || userAgent
                        ? ({ ipAddress, userAgent } as InputJsonValue)
                        : undefined,
            },
        });

        logger.debug("AuditLog: Entry created in transaction", {
            entityType: params.entityType,
            entityId: params.entityId,
            action: params.action,
        });
    } catch (error) {
        logger.error("AuditLog: Failed to create entry in transaction", {
            entityType: params.entityType,
            entityId: params.entityId,
            action: params.action,
            error,
        });
    }
}

export async function audit(
    context: AuditContext,
    params: AuditParams,
): Promise<void> {
    const { requestId, user, logger, ipAddress, userAgent } = context;

    try {
        await prisma.auditLog.create({
            data: {
                requestId: requestId ?? null,
                actorId: user?.id ?? null,
                actorType: getActorType(user),
                entityType: params.entityType,
                entityId: params.entityId,
                action: params.action,
                previousData: params.previousData as InputJsonValue | undefined,
                newData: params.newData as InputJsonValue | undefined,
                metadata:
                    ipAddress || userAgent
                        ? ({ ipAddress, userAgent } as InputJsonValue)
                        : undefined,
            },
        });

        logger.debug("AuditLog: Entry created", {
            entityType: params.entityType,
            entityId: params.entityId,
            action: params.action,
        });
    } catch (error) {
        logger.error("AuditLog: Failed to create entry", {
            entityType: params.entityType,
            entityId: params.entityId,
            action: params.action,
            error,
        });
    }
}
