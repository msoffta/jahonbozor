import z from "zod";

import { PaginationQuery } from "../common/pagination.model";
import { LanguageSchema, telegramIdSchema, User } from "./users.model";

export const CreateUserBody = User.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
});

export const UpdateUserBody = CreateUserBody.partial();

export const TelegramAuthBody = z.object({
    id: telegramIdSchema,
    first_name: z.string(),
    last_name: z.string().nullish(),
    username: z.string().nullish(),
    photo_url: z.string().nullish(),
    auth_date: z.number(),
    hash: z.string(),
});

export const TelegramLoginBody = TelegramAuthBody.extend({
    language: LanguageSchema.optional(),
});

export const TelegramWebAppAuthBody = z.object({
    initData: z.string().min(1),
    language: LanguageSchema.optional(),
});

export const UsersPagination = PaginationQuery.extend({
    searchQuery: z.string().optional(),
    includeOrders: z.preprocess((val) => {
        if (val === undefined || val === null || val === "") return undefined;
        return val === "true" || val === true;
    }, z.boolean().optional()),
    includeDeleted: z.preprocess((val) => {
        if (val === undefined || val === null || val === "") return undefined;
        return val === "true" || val === true;
    }, z.boolean().optional()),
});

export type CreateUserBody = z.infer<typeof CreateUserBody>;
export type UpdateUserBody = z.infer<typeof UpdateUserBody>;
export type TelegramAuthBody = z.infer<typeof TelegramAuthBody>;
export type TelegramLoginBody = z.infer<typeof TelegramLoginBody>;
export type TelegramWebAppAuthBody = z.infer<typeof TelegramWebAppAuthBody>;
export type UsersPagination = z.infer<typeof UsersPagination>;

// --- Response types ---

import type { ReturnSchema } from "../common/base.model";

export interface AdminUserItem {
    id: number;
    fullname: string;
    phone: string | null;
    telegramId: unknown;
    photo: string | null;
    language: string;
    deletedAt: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export type AdminUsersListResponse = ReturnSchema<{
    count: number;
    users: AdminUserItem[];
}>;
export type AdminUserDetailResponse = ReturnSchema<AdminUserItem>;
export type TelegramAuthResponse = ReturnSchema<{
    user: AdminUserItem;
    token: string;
}>;
