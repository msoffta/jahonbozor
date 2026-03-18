import z from "zod";

import type { ReturnSchema } from "../common/base.model";

// --- Request schemas ---

export const CreateDebtPaymentBody = z.object({
    amount: z.number().positive(),
    comment: z.string().nullish(),
});

export type CreateDebtPaymentBody = z.infer<typeof CreateDebtPaymentBody>;

// --- Response types ---

export interface DebtPaymentItem {
    id: number;
    orderId: number;
    userId: number;
    amount: number;
    paidAt: Date | string;
    staffId: number;
    comment: string | null;
    staff: { id: number; fullname: string };
    createdAt: Date | string;
}

export interface DebtSummary {
    totalDebt: number;
    totalPaid: number;
    balance: number;
    debtOrdersCount: number;
}

export interface DebtOrderItem {
    orderId: number;
    userId: number | null;
    orderTotal: number;
    paidAmount: number;
    remainingAmount: number;
    createdAt: Date | string;
    payments: DebtPaymentItem[];
}

export type DebtSummaryResponse = ReturnSchema<DebtSummary>;
export type DebtOrdersResponse = ReturnSchema<{ orders: DebtOrderItem[] }>;
export type DebtPaymentResponse = ReturnSchema<DebtPaymentItem>;
export type DebtPaymentsListResponse = ReturnSchema<{ payments: DebtPaymentItem[] }>;
