import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@jahonbozor/ui";

import { api } from "@/api/client";
import { i18n } from "@/i18n/config";

import type { DebtOrderItem, DebtPaymentItem, DebtSummary } from "@jahonbozor/schemas/src/debts";

export const debtKeys = {
    all: ["debts"] as const,
    summary: (userId: number) => [...debtKeys.all, "summary", userId] as const,
    orders: (userId: number) => [...debtKeys.all, "orders", userId] as const,
    payments: (orderId: number) => [...debtKeys.all, "payments", orderId] as const,
};

export const debtSummaryQueryOptions = (userId: number) =>
    queryOptions({
        queryKey: debtKeys.summary(userId),
        queryFn: async (): Promise<DebtSummary> => {
            const { data, error } = await api.api.private.debts.users({ userId }).summary.get();
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as DebtSummary;
        },
        enabled: userId > 0,
    });

export const debtOrdersQueryOptions = (userId: number) =>
    queryOptions({
        queryKey: debtKeys.orders(userId),
        queryFn: async (): Promise<{ orders: DebtOrderItem[] }> => {
            const { data, error } = await api.api.private.debts.users({ userId }).orders.get();
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as { orders: DebtOrderItem[] };
        },
        enabled: userId > 0,
    });

export const debtPaymentsQueryOptions = (orderId: number) =>
    queryOptions({
        queryKey: debtKeys.payments(orderId),
        queryFn: async (): Promise<{ payments: DebtPaymentItem[] }> => {
            const { data, error } = await api.api.private.debts.orders({ orderId }).payments.get();
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as { payments: DebtPaymentItem[] };
        },
        enabled: orderId > 0,
    });

export const createDebtPaymentFn = async ({
    orderId,
    amount,
    comment,
}: {
    orderId: number;
    amount: number;
    comment?: string | null;
}) => {
    const { data, error } = await api.api.private.debts
        .orders({ orderId })
        .payments.post({ amount, comment });
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as DebtPaymentItem;
};

export function useCreateDebtPayment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createDebtPaymentFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: debtKeys.all });
            toast.success(i18n.t("clients:debt_payment_recorded"));
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
}
