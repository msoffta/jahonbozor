import z from "zod";

import { BaseModel } from "../common/base.model";

export const TelegramSessionStatusSchema = z.enum(["ACTIVE", "DISCONNECTED", "BANNED"]);
export type TelegramSessionStatus = z.infer<typeof TelegramSessionStatusSchema>;

export const TelegramSession = BaseModel.extend({
    name: z.string().min(1).max(255),
    phone: z.string().min(1),
    apiId: z.number(),
    apiHash: z.string(),
    sessionString: z.string(),
    status: TelegramSessionStatusSchema.default("ACTIVE"),
    lastUsedAt: z.union([z.coerce.date(), z.iso.datetime()]).nullable(),
    deletedAt: z.union([z.coerce.date(), z.iso.datetime()]).nullable(),
});

export type TelegramSession = z.infer<typeof TelegramSession>;
