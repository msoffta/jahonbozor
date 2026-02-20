import z from "zod";
import { BaseModel } from "../base.model";
import { PermissionsArraySchema } from "../permissions";

export const Staff = BaseModel.extend({
    fullname: z.string(),
    username: z.string(),
    telegramId: z
        .union([z.string(), z.number()])
        .transform((telegramId) => telegramId.toString()),
    passwordHash: z.string(),
    roleId: z.number(),
    role: z.object({
        name: z.string(),
        permissions: PermissionsArraySchema,
    }),
});

export const AuthStaff = Staff.pick({
    id: true,
    fullname: true,
    username: true,
    passwordHash: true,
    roleId: true,
});

export const TokenStaff = Staff.pick({
    id: true,
    fullname: true,
    username: true,
    roleId: true,
}).extend({
    type: z.literal("staff"),
});

export type Staff = z.infer<typeof Staff>;
export type AuthStaff = z.infer<typeof AuthStaff>;
export type TokenStaff = z.infer<typeof TokenStaff>;
