import z from "zod";
import { OrderStatus, PaymentType } from "../common/enums";
import { PaginationQuery } from "../common/pagination.model";
import { Order, OrderItem } from "./orders.model";

export const CreateOrderItemBody = OrderItem.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    orderId: true,
}).extend({
    data: z.record(z.string(), z.unknown()).nullish(),
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
    comment: z.string().nullish(),
    data: z.record(z.string(), z.unknown()).nullish(),
    items: z.array(CreateOrderItemBody).min(1),
});

export const UpdateOrderBody = Order.pick({
    paymentType: true,
    status: true,
    comment: true,
    data: true,
}).partial();

export const OrdersPagination = PaginationQuery.extend({
    userId: z.coerce.number().optional(),
    staffId: z.coerce.number().optional(),
    paymentType: PaymentType.optional(),
    status: OrderStatus.optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    itemsCount: z.coerce.number().optional(),
    minItemsCount: z.coerce.number().optional(),
});

export type CreateOrderItemBody = z.infer<typeof CreateOrderItemBody>;
export type CreateOrderBody = z.infer<typeof CreateOrderBody>;
export type UpdateOrderBody = z.infer<typeof UpdateOrderBody>;
export type OrdersPagination = z.infer<typeof OrdersPagination>;

// --- Response types ---

import type { ReturnSchema } from "../common/base.model";

export interface OrderItemResponse {
    id: number;
    productId: number;
    quantity: number;
    price: number;
    data: unknown;
    product: {
        id: number;
        name: string;
        price?: number;
        remaining?: number;
        costprice?: number;
    };
}

// Public (user) API responses
export interface UserOrderItem {
    id: number;
    paymentType: string;
    status: string;
    comment: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    items: OrderItemResponse[];
}

export type UserOrdersListResponse = ReturnSchema<{
    count: number;
    orders: UserOrderItem[];
}>;
export type UserOrderDetailResponse = ReturnSchema<UserOrderItem>;
export type UserOrderCreateResponse = ReturnSchema<UserOrderItem>;
export type UserOrderCancelResponse = ReturnSchema<UserOrderItem>;

// Admin API responses
export interface AdminOrderItem extends UserOrderItem {
    userId: number | null;
    staffId: number | null;
    data: unknown;
    user: { id: number; fullname: string; phone: string | null } | null;
    staff?: { id: number; fullname: string } | null;
}

export type AdminOrdersListResponse = ReturnSchema<{
    count: number;
    orders: AdminOrderItem[];
}>;
export type AdminOrderDetailResponse = ReturnSchema<AdminOrderItem>;
export type AdminOrderDeleteResponse = ReturnSchema<{
    orderId: number;
    deleted: true;
}>;
