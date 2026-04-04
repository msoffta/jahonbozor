import z from "zod";

import { InlineButton, MediaAttachment } from "../broadcast-templates/broadcast-templates.model";
import { PaginationQuery } from "../common/pagination.model";
import {
    BroadcastRecipientStatusSchema,
    BroadcastSendViaSchema,
    BroadcastStatusSchema,
} from "./broadcasts.model";

import type { ReturnSchema } from "../common/base.model";

export const CreateBroadcastBody = z.object({
    name: z.string().min(1).max(255),
    content: z.string().optional(),
    media: z.array(MediaAttachment).optional(),
    buttons: z.array(InlineButton).optional(),
    templateId: z.number().optional(),
    sendVia: BroadcastSendViaSchema,
    sessionId: z.number().optional(),
    recipientUserIds: z.array(z.number()).min(1),
    scheduledAt: z.string().datetime().optional(),
});

export const UpdateBroadcastBody = z.object({
    name: z.string().min(1).max(255).optional(),
    content: z.string().optional(),
    media: z.array(MediaAttachment).optional(),
    buttons: z.array(InlineButton).optional(),
    templateId: z.number().nullable().optional(),
    sessionId: z.number().optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
});

export const BroadcastsPagination = PaginationQuery.extend({
    status: BroadcastStatusSchema.optional(),
    sendVia: BroadcastSendViaSchema.optional(),
    sessionId: z.coerce.number().optional(),
    includeDeleted: z.preprocess((val) => {
        if (val === undefined || val === null || val === "") return undefined;
        return val === "true" || val === true;
    }, z.boolean().optional()),
});

export const BroadcastRecipientsPagination = PaginationQuery.extend({
    status: BroadcastRecipientStatusSchema.optional(),
});

export type CreateBroadcastBody = z.infer<typeof CreateBroadcastBody>;
export type UpdateBroadcastBody = z.infer<typeof UpdateBroadcastBody>;
export type BroadcastsPagination = z.infer<typeof BroadcastsPagination>;
export type BroadcastRecipientsPagination = z.infer<typeof BroadcastRecipientsPagination>;

// --- Response types ---

export interface BroadcastRecipientItem {
    id: number;
    userId: number;
    telegramId: string;
    status: string;
    errorMessage: string | null;
    sentAt: Date | string | null;
    user?: { id: number; fullname: string; username: string };
}

export interface BroadcastStats {
    total: number;
    sent: number;
    failed: number;
    pending: number;
}

export interface BroadcastItem {
    id: number;
    name: string;
    content: string | null;
    media: unknown;
    buttons: unknown;
    templateId: number | null;
    sendVia: string;
    sessionId: number | null;
    status: string;
    scheduledAt: Date | string | null;
    startedAt: Date | string | null;
    completedAt: Date | string | null;
    createdById: number;
    deletedAt: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    template?: { id: number; name: string } | null;
    session?: { id: number; name: string } | null;
    stats?: BroadcastStats;
}

export type BroadcastsListResponse = ReturnSchema<{
    count: number;
    broadcasts: BroadcastItem[];
}>;

export type BroadcastDetailResponse = ReturnSchema<BroadcastItem>;

export type BroadcastRecipientsResponse = ReturnSchema<{
    count: number;
    recipients: BroadcastRecipientItem[];
}>;

export type BroadcastActionResponse = ReturnSchema<{
    broadcastId: number;
    status: string;
}>;
