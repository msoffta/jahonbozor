import z from "zod";

export const PaginationQuery = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    searchQuery: z.string().optional().default(""),
});

export type PaginationQuery = z.infer<typeof PaginationQuery>;

export const PaginatedResponse = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
        items: z.array(itemSchema),
        total: z.number(),
        page: z.number(),
        limit: z.number(),
        totalPages: z.number(),
    });
