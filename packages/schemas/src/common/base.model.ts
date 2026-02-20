import z from "zod";

export const BaseModel = z.object({
    id: z.number(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
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

export type ReturnSchema<T = Record<string, any> | null> =
    | { success: true; data: T }
    | { success: false; error: unknown };
