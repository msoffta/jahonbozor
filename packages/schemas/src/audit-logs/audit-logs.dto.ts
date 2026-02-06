import z from "zod";
import { PaginationQuery } from "../common/pagination.model";
import { AuditAction, ActorType } from "../common/enums";

export const AuditLogPagination = PaginationQuery.extend({
    entityType: z.string().optional(),
    entityId: z.coerce.number().optional(),
    actorId: z.coerce.number().optional(),
    actorType: ActorType.optional(),
    action: AuditAction.optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    requestId: z.string().optional(),
});

export type AuditLogPagination = z.infer<typeof AuditLogPagination>;

export const CreateAuditLogData = z.object({
    requestId: z.string().nullish(),
    actorId: z.number().nullable(),
    actorType: ActorType,
    entityType: z.string(),
    entityId: z.number(),
    action: AuditAction,
    previousData: z.record(z.string(), z.unknown()).nullish(),
    newData: z.record(z.string(), z.unknown()).nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
});

export type CreateAuditLogData = z.infer<typeof CreateAuditLogData>;
