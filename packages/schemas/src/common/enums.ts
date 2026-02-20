import z from "zod";

export const PaymentType = z.enum(["CASH", "CREDIT_CARD"]);
export type PaymentType = z.infer<typeof PaymentType>;

export const OrderStatus = z.enum(["NEW", "ACCEPTED", "CANCELLED"]);
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

export const AuditAction = z.enum([
    "CREATE",
    "UPDATE",
    "DELETE",
    "RESTORE",
    "LOGIN",
    "LOGOUT",
    "PASSWORD_CHANGE",
    "PERMISSION_CHANGE",
    "ORDER_STATUS_CHANGE",
    "INVENTORY_ADJUST",
]);
export type AuditAction = z.infer<typeof AuditAction>;

export const ActorType = z.enum(["STAFF", "USER", "SYSTEM"]);
export type ActorType = z.infer<typeof ActorType>;
