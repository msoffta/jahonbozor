import z from "zod";

import { BaseModel } from "../common/base.model";

export const BroadcastStatusSchema = z.enum([
    "DRAFT",
    "SCHEDULED",
    "SENDING",
    "PAUSED",
    "COMPLETED",
    "FAILED",
]);
export type BroadcastStatus = z.infer<typeof BroadcastStatusSchema>;

export const BroadcastSendViaSchema = z.enum(["BOT", "SESSION"]);
export type BroadcastSendVia = z.infer<typeof BroadcastSendViaSchema>;

export const BroadcastRecipientStatusSchema = z.enum(["PENDING", "SENT", "FAILED"]);
export type BroadcastRecipientStatus = z.infer<typeof BroadcastRecipientStatusSchema>;

export const Broadcast = BaseModel.extend({
    name: z.string().min(1).max(255),
    content: z.string().nullable(),
    media: z.array(z.unknown()).nullable(),
    buttons: z.array(z.unknown()).nullable(),
    templateId: z.number().nullable(),
    sessionId: z.number().nullable(),
    sendVia: BroadcastSendViaSchema.default("SESSION"),
    status: BroadcastStatusSchema.default("DRAFT"),
    scheduledAt: z.union([z.coerce.date(), z.iso.datetime()]).nullable(),
    startedAt: z.union([z.coerce.date(), z.iso.datetime()]).nullable(),
    completedAt: z.union([z.coerce.date(), z.iso.datetime()]).nullable(),
    createdById: z.number(),
    deletedAt: z.union([z.coerce.date(), z.iso.datetime()]).nullable(),
});

export type Broadcast = z.infer<typeof Broadcast>;
