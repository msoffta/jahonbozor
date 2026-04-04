import z from "zod";

import { PaginationQuery } from "../common/pagination.model";
import { InlineButton, MediaAttachment } from "./broadcast-templates.model";

import type { ReturnSchema } from "../common/base.model";

export const CreateBroadcastTemplateBody = z.object({
    name: z.string().min(1).max(255),
    content: z.string().min(1),
    media: z.array(MediaAttachment).nullable().optional(),
    buttons: z.array(InlineButton).nullable().optional(),
});

export const UpdateBroadcastTemplateBody = CreateBroadcastTemplateBody.partial();

export const BroadcastTemplatesPagination = PaginationQuery.extend({
    includeDeleted: z.preprocess((val) => {
        if (val === undefined || val === null || val === "") return undefined;
        return val === "true" || val === true;
    }, z.boolean().optional()),
});

export type CreateBroadcastTemplateBody = z.infer<typeof CreateBroadcastTemplateBody>;
export type UpdateBroadcastTemplateBody = z.infer<typeof UpdateBroadcastTemplateBody>;
export type BroadcastTemplatesPagination = z.infer<typeof BroadcastTemplatesPagination>;

// --- Response types ---

export interface BroadcastTemplateItem {
    id: number;
    name: string;
    content: string;
    media: unknown;
    buttons: unknown;
    deletedAt: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export type BroadcastTemplatesListResponse = ReturnSchema<{
    count: number;
    templates: BroadcastTemplateItem[];
}>;

export type BroadcastTemplateDetailResponse = ReturnSchema<BroadcastTemplateItem>;
