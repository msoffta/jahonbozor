import z from "zod";

import { BaseModel } from "../common/base.model";

export const DebtPayment = BaseModel.extend({
    orderId: z.number(),
    userId: z.number(),
    amount: z.number().positive(),
    paidAt: z.union([z.coerce.date(), z.iso.datetime()]),
    staffId: z.number(),
    comment: z.string().nullable(),
});

export type DebtPayment = z.infer<typeof DebtPayment>;
