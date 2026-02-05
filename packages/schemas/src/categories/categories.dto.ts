import z from "zod";
import { PaginationQuery } from "../common/pagination.model";
import { Category, Subcategory } from "./categories.model";

export const CreateCategoryBody = Category.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export const UpdateCategoryBody = CreateCategoryBody.partial();

export const CreateSubcategoryBody = Subcategory.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export const UpdateSubcategoryBody = CreateSubcategoryBody.partial();

export const CategoriesPagination = PaginationQuery.extend({
    includeSubcategories: z.coerce.boolean().optional(),
    includeProducts: z.coerce.boolean().optional(),
});

export const SubcategoriesPagination = PaginationQuery.extend({
    categoryId: z.coerce.number().optional(),
    includeCategory: z.coerce.boolean().optional(),
    includeProducts: z.coerce.boolean().optional(),
});

export type CreateCategoryBody = z.infer<typeof CreateCategoryBody>;
export type UpdateCategoryBody = z.infer<typeof UpdateCategoryBody>;
export type CreateSubcategoryBody = z.infer<typeof CreateSubcategoryBody>;
export type UpdateSubcategoryBody = z.infer<typeof UpdateSubcategoryBody>;
export type CategoriesPagination = z.infer<typeof CategoriesPagination>;
export type SubcategoriesPagination = z.infer<typeof SubcategoriesPagination>;
