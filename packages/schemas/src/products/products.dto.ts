import z from "zod";
import { PaginationQuery } from "../common/pagination.model";
import { Product } from "./products.model";

export const CreateProductBody = Product.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
}).extend({
    remaining: z.number().nonnegative().optional().default(0),
});

export const UpdateProductBody = CreateProductBody.partial();

export const ProductsPagination = PaginationQuery.extend({
    categoryIds: z.string().optional(),
    minPrice: z.coerce.number().optional(),
    maxPrice: z.coerce.number().optional(),
    includeDeleted: z.coerce.boolean().optional().default(false),
});

export type CreateProductBody = z.infer<typeof CreateProductBody>;
export type UpdateProductBody = z.infer<typeof UpdateProductBody>;
export type ProductsPagination = z.infer<typeof ProductsPagination>;

// --- Response types ---

import type { ReturnSchema } from "../common/base.model";

interface ProductCategoryRelation {
    id: number;
    name: string;
    parent: { id: number; name: string } | null;
}

// Public API (select — no costprice, no deletedAt)
export interface PublicProductItem {
    id: number;
    name: string;
    price: number;
    categoryId: number;
    remaining: number;
    createdAt: string;
    updatedAt: string;
    category?: ProductCategoryRelation;
}

export type PublicProductsListResponse = ReturnSchema<{ count: number; products: PublicProductItem[] }>;
export type PublicProductDetailResponse = ReturnSchema<PublicProductItem>;

// Admin API (include — all fields)
export interface AdminProductItem extends PublicProductItem {
    costprice: number;
    deletedAt: string | null;
}

export type AdminProductsListResponse = ReturnSchema<{ count: number; products: AdminProductItem[] }>;
export type AdminProductDetailResponse = ReturnSchema<AdminProductItem>;
