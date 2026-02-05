import z from "zod";

export const BaseModel = z.object({
    id: z.number(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
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

export type ReturnSchema = z.infer<typeof ReturnSchema>;
