import z from "zod";

import { BaseModel } from "../common/base.model";

export const InlineButton = z.object({
    text: z.string().min(1),
    url: z.string().url(),
});
export type InlineButton = z.infer<typeof InlineButton>;

export const MediaAttachment = z.object({
    type: z.enum(["photo", "video", "document"]),
    url: z.string().min(1),
});
export type MediaAttachment = z.infer<typeof MediaAttachment>;

export const BroadcastTemplate = BaseModel.extend({
    name: z.string().min(1).max(255),
    content: z.string().min(1),
    media: z.array(MediaAttachment).nullable(),
    buttons: z.array(InlineButton).nullable(),
    deletedAt: z.union([z.coerce.date(), z.iso.datetime()]).nullable(),
});

export type BroadcastTemplate = z.infer<typeof BroadcastTemplate>;
