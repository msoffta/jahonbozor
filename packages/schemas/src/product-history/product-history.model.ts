import z from "zod";
import { BaseModel } from "../common/base.model";
import { Operation } from "../common/enums";

export const ProductHistory = BaseModel.extend({
    productId: z.number(),
    staffId: z.number().nullable(),
    operation: Operation,
    quantity: z.number().nullable(),
    previousData: z.record(z.string(), z.any()).nullable(),
    newData: z.record(z.string(), z.any()).nullable(),
    changeReason: z.string().nullable(),
});

export type ProductHistory = z.infer<typeof ProductHistory>;
