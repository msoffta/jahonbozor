import z from "zod";
import { AuditAction, ActorType } from "../common/enums";

export const AuditLog = z.object({
    id: z.number(),
    requestId: z.string().nullable(),
    actorId: z.number().nullable(),
    actorType: ActorType,
    entityType: z.string(),
    entityId: z.number(),
    action: AuditAction,
    previousData: z.record(z.string(), z.unknown()).nullable(),
    newData: z.record(z.string(), z.unknown()).nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    createdAt: z.string().datetime(),
});

export type AuditLog = z.infer<typeof AuditLog>;
