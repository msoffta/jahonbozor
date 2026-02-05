import z from "zod";
import { BaseModel } from "../common/base.model";

export const Product = BaseModel.extend({
    name: z.string().min(1).max(255),
    price: z.number().positive(),
    costprice: z.number().nonnegative(),
    categoryId: z.number(),
    subcategoryId: z.number().nullable(),
    remaining: z.number().nonnegative().default(0),
    deletedAt: z.coerce.date().nullable(),
});

export type Product = z.infer<typeof Product>;

export const PublicProduct = Product.omit({ costprice: true });
export type PublicProduct = z.infer<typeof PublicProduct>;
