import z from "zod";
import { BaseModel } from "../base.model";

// Telegram ID может быть string или number — преобразуем в string для хранения
export const telegramIdSchema = z
    .union([z.string(), z.number()])
    .transform((telegramId) => telegramId.toString());

export const LanguageSchema = z.enum(["uz", "ru"]);
export type Language = z.infer<typeof LanguageSchema>;

export const User = BaseModel.extend({
    fullname: z.string(),
    username: z.string(),
    phone: z.string().nullable(),
    photo: z.string().nullable(),
    telegramId: telegramIdSchema.nullable(),
    language: LanguageSchema.default("uz"),
    deletedAt: z.string().datetime().nullable(),
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
