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

// --- Response types ---

import type { ReturnSchema } from "../common/base.model";

// Public API responses
export interface PublicCategoryItem {
    id: number;
    name: string;
    children: { id: number; name: string }[];
}

export type PublicCategoriesListResponse = ReturnSchema<{ categories: PublicCategoryItem[] }>;

export interface PublicCategoryDetail {
    id: number;
    name: string;
    parentId: number | null;
    parent: { id: number; name: string } | null;
    children: { id: number; name: string }[];
}

export type PublicCategoryDetailResponse = ReturnSchema<PublicCategoryDetail>;

// Admin API responses
export interface AdminCategoryItem {
    id: number;
    name: string;
    parentId: number | null;
    createdAt: string;
    updatedAt: string;
}

export type AdminCategoriesListResponse = ReturnSchema<{ count: number; categories: AdminCategoryItem[] }>;
export type AdminCategoryDetailResponse = ReturnSchema<AdminCategoryItem>;
export type AdminCategoryTreeResponse = ReturnSchema<{ categories: AdminCategoryItem[] }>;
