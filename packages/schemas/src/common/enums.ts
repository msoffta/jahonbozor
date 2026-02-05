import z from "zod";

export const PaymentType = z.enum(["CASH", "CREDIT_CARD"]);
export type PaymentType = z.infer<typeof PaymentType>;

export const OrderStatus = z.enum(["NEW", "ACCEPTED"]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const Operation = z.enum([
    "CREATE",
    "UPDATE",
    "DELETE",
    "RESTORE",
    "INVENTORY_ADD",
    "INVENTORY_REMOVE",
]);
export type Operation = z.infer<typeof Operation>;
