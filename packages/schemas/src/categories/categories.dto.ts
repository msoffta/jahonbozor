import z from "zod";
import { PaginationQuery } from "../common/pagination.model";
import { Category } from "./categories.model";

export const CreateCategoryBody = Category.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
}).extend({
    parentId: z.number().nullish(),
});

export const UpdateCategoryBody = CreateCategoryBody.partial();

export const CategoriesPagination = PaginationQuery.extend({
    parentId: z.coerce.number().nullish(),
    includeChildren: z.coerce.boolean().optional(),
    includeProducts: z.coerce.boolean().optional(),
    includeParent: z.coerce.boolean().optional(),
    depth: z.coerce.number().min(1).max(5).optional().default(1),
});

export type CreateCategoryBody = z.infer<typeof CreateCategoryBody>;
export type UpdateCategoryBody = z.infer<typeof UpdateCategoryBody>;
export type CategoriesPagination = z.infer<typeof CategoriesPagination>;
