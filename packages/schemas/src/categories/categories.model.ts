import z from "zod";
import { BaseModel } from "../common/base.model";

export const Category = BaseModel.extend({
    name: z.string().min(1).max(255),
    parentId: z.number().nullable(),
});

export type Category = z.infer<typeof Category>;
