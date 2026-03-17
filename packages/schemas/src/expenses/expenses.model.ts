import z from "zod";

import { BaseModel } from "../common/base.model";

export const Expense = BaseModel.extend({
    name: z.string().min(1).max(255),
    amount: z.number().positive(),
    description: z.string().max(1000).nullable(),
    expenseDate: z.union([z.coerce.date(), z.iso.datetime()]),
    staffId: z.number(),
    deletedAt: z.union([z.coerce.date(), z.iso.datetime()]).nullable(),
});

export type Expense = z.infer<typeof Expense>;
