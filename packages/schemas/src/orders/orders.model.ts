import z from "zod";
import { BaseModel } from "../common/base.model";
import { PaymentType, OrderStatus } from "../common/enums";

export const OrderItem = BaseModel.extend({
    orderId: z.number(),
    productId: z.number(),
    quantity: z.number().positive(),
    price: z.number().positive(),
    data: z.record(z.string(), z.unknown()).nullable(),
});

export const Order = BaseModel.extend({
    userId: z.number().nullable(),
    staffId: z.number().nullable(),
    paymentType: PaymentType,
    status: OrderStatus,
    data: z.record(z.string(), z.unknown()).nullable(),
    items: z.array(OrderItem.omit({ orderId: true })).optional(),
});

export type OrderItem = z.infer<typeof OrderItem>;
export type Order = z.infer<typeof Order>;
