import z from "zod";
import { BaseModel } from "../base.model";

const telegramIdSchema = z
    .union([z.bigint(), z.string(), z.number()])
    .transform((telegramId) => telegramId.toString());

export const User = BaseModel.extend({
    fullname: z.string(),
    username: z.string(),
    phone: z.string(),
    photo: z.string().nullable(),
    telegramId: telegramIdSchema.nullable(),
});

export const TokenUser = User.pick({
    id: true,
    fullname: true,
    username: true,
    phone: true,
    telegramId: true,
}).extend({
    type: z.literal("user"),
});

export type User = z.infer<typeof User>;
export type TokenUser = z.infer<typeof TokenUser>;
