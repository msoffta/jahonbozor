import z from "zod";
import { BaseModel } from "../common/base.model";

export const Category = BaseModel.extend({
    name: z.string().min(1).max(255),
});

export const Subcategory = BaseModel.extend({
    name: z.string().min(1).max(255),
    categoryId: z.number(),
});

export type Category = z.infer<typeof Category>;
export type Subcategory = z.infer<typeof Subcategory>;
