import z from "zod";

import { PaginationQuery } from "../common/pagination.model";
import { TelegramSessionStatusSchema } from "./telegram-sessions.model";

import type { ReturnSchema } from "../common/base.model";

export const CreateTelegramSessionBody = z.object({
    name: z.string().min(1).max(255),
    phone: z.string().min(1),
    apiId: z.number().optional(),
    apiHash: z.string().optional(),
});

export const UpdateTelegramSessionBody = z.object({
    name: z.string().min(1).max(255).optional(),
});

export const TelegramSessionsPagination = PaginationQuery.extend({
    status: TelegramSessionStatusSchema.optional(),
    includeDeleted: z.preprocess((val) => {
        if (val === undefined || val === null || val === "") return undefined;
        return val === "true" || val === true;
    }, z.boolean().optional()),
});

export type CreateTelegramSessionBody = z.infer<typeof CreateTelegramSessionBody>;
export type UpdateTelegramSessionBody = z.infer<typeof UpdateTelegramSessionBody>;
export type TelegramSessionsPagination = z.infer<typeof TelegramSessionsPagination>;

// --- Response types ---

export interface TelegramSessionItem {
    id: number;
    name: string;
    phone: string;
    status: string;
    lastUsedAt: Date | string | null;
    deletedAt: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export type TelegramSessionsListResponse = ReturnSchema<{
    count: number;
    sessions: TelegramSessionItem[];
}>;

export type TelegramSessionDetailResponse = ReturnSchema<TelegramSessionItem>;

export type TelegramSessionQrResponse = ReturnSchema<{
    qrUrl: string;
    token: string;
}>;

export type TelegramSessionQrStatusResponse = ReturnSchema<{
    status: "waiting" | "authenticated" | "expired" | "needs_password";
    sessionId?: number;
}>;
