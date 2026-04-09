import z from "zod";

export const PaymentType = z.enum(["CASH", "CREDIT_CARD", "DEBT"]);
export type PaymentType = z.infer<typeof PaymentType>;

export const OrderStatus = z.enum(["DRAFT", "COMPLETED"]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const OrderType = z.enum(["ORDER", "LIST"]);
export type OrderType = z.infer<typeof OrderType>;

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
    "INVENTORY_ADJUST",
    "DEBT_PAYMENT",
]);
export type AuditAction = z.infer<typeof AuditAction>;

export const ActorType = z.enum(["STAFF", "USER", "SYSTEM"]);
export type ActorType = z.infer<typeof ActorType>;
