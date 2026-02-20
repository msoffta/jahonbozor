import z from "zod";
import { PaginationQuery } from "../common/pagination.model";
import { User, telegramIdSchema } from "./users.model";

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

export const UsersPagination = PaginationQuery.extend({
    searchQuery: z.string().optional(),
    includeOrders: z.coerce.boolean().optional(),
    includeDeleted: z.coerce.boolean().optional(),
});

export type CreateUserBody = z.infer<typeof CreateUserBody>;
export type UpdateUserBody = z.infer<typeof UpdateUserBody>;
export type TelegramAuthBody = z.infer<typeof TelegramAuthBody>;
export type UsersPagination = z.infer<typeof UsersPagination>;

// --- Response types ---

import type { ReturnSchema } from "../common/base.model";

export interface AdminUserItem {
    id: number;
    fullname: string;
    username: string;
    phone: string | null;
    telegramId: unknown;
    photo: string | null;
    deletedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export type AdminUsersListResponse = ReturnSchema<{ count: number; users: AdminUserItem[] }>;
export type AdminUserDetailResponse = ReturnSchema<AdminUserItem>;
export type TelegramAuthResponse = ReturnSchema<{ user: AdminUserItem; token: string }>;
