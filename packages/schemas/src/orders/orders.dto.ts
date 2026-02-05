import z from "zod";
import { PaginationQuery } from "../common/pagination.model";
import { PaymentType, OrderStatus } from "../common/enums";
import { Order, OrderItem } from "./orders.model";

export const CreateOrderItemBody = OrderItem.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    orderId: true,
}).extend({
    data: z.record(z.string(), z.any()).nullish(),
});

export const CreateOrderBody = Order.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    staffId: true,
    status: true,
    items: true,
}).extend({
    userId: z.number().nullish(),
    data: z.record(z.string(), z.any()).nullish(),
    items: z.array(CreateOrderItemBody).min(1),
});

export const UpdateOrderBody = Order.pick({
    paymentType: true,
    status: true,
    data: true,
}).partial();

export const OrdersPagination = PaginationQuery.extend({
    userId: z.coerce.number().optional(),
    staffId: z.coerce.number().optional(),
    paymentType: PaymentType.optional(),
    status: OrderStatus.optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
});

export type CreateOrderItemBody = z.infer<typeof CreateOrderItemBody>;
export type CreateOrderBody = z.infer<typeof CreateOrderBody>;
export type UpdateOrderBody = z.infer<typeof UpdateOrderBody>;
export type OrdersPagination = z.infer<typeof OrdersPagination>;
