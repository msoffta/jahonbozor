import z from "zod";
import { PaginationQuery } from "../common/pagination.model";
import { Product } from "./products.model";

export const CreateProductBody = Product.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
}).extend({
    subcategoryId: z.number().nullish(),
    remaining: z.number().nonnegative().optional().default(0),
});

export const UpdateProductBody = CreateProductBody.partial();

export const ProductsPagination = PaginationQuery.extend({
    categoryId: z.coerce.number().optional(),
    subcategoryId: z.coerce.number().optional(),
    minPrice: z.coerce.number().optional(),
    maxPrice: z.coerce.number().optional(),
    includeDeleted: z.coerce.boolean().optional().default(false),
});

export type CreateProductBody = z.infer<typeof CreateProductBody>;
export type UpdateProductBody = z.infer<typeof UpdateProductBody>;
export type ProductsPagination = z.infer<typeof ProductsPagination>;
