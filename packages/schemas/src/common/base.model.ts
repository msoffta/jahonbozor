import z from "zod";

export const BaseModel = z.object({
    id: z.number(),
    createdAt: z.union([z.coerce.date(), z.iso.datetime()]),
    updatedAt: z.union([z.coerce.date(), z.iso.datetime()]),
});

export type BaseModel = z.infer<typeof BaseModel>;

export const ReturnSchema = z.discriminatedUnion("success", [
    z.object({
        success: z.literal(true),
        data: z.record(z.string(), z.any()).nullable(),
    }),
    z.object({
        success: z.literal(false),
        error: z.unknown(),
    }),
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReturnSchema<T = Record<string, any> | null> =
    | { success: true; data: T }
    | { success: false; error: unknown };
