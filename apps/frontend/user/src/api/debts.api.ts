import { queryOptions } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { unwrap } from "@/lib/eden-utils";

import type { DebtPaymentItem, DebtSummary } from "@jahonbozor/schemas/src/debts";

export const debtKeys = {
    all: ["debts"] as const,
    summary: () => [...debtKeys.all, "summary"] as const,
    payments: () => [...debtKeys.all, "payments"] as const,
};

export const myDebtSummaryOptions = () =>
    queryOptions({
        queryKey: debtKeys.summary(),
        queryFn: async (): Promise<DebtSummary> => unwrap(await api.api.public.debts.summary.get()),
    });

export const myDebtPaymentsOptions = () =>
    queryOptions({
        queryKey: debtKeys.payments(),
        queryFn: async (): Promise<{ payments: DebtPaymentItem[] }> =>
            unwrap(await api.api.public.debts.payments.get()),
    });
