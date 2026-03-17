import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@jahonbozor/ui";

import { api } from "@/api/client";
import { i18n } from "@/i18n/config";

import type { ExpenseItem } from "@jahonbozor/schemas/src/expenses";

export const expenseKeys = {
    all: ["expenses"] as const,
    lists: () => [...expenseKeys.all, "list"] as const,
    list: (params?: Record<string, unknown>) => [...expenseKeys.lists(), params] as const,
    details: () => [...expenseKeys.all, "detail"] as const,
    detail: (id: number) => [...expenseKeys.details(), id] as const,
};

export const expensesListQueryOptions = (params?: {
    page?: number;
    limit?: number;
    searchQuery?: string;
    staffId?: number;
    dateFrom?: string;
    dateTo?: string;
    includeDeleted?: boolean;
}) =>
    queryOptions({
        queryKey: expenseKeys.list(params),
        queryFn: async (): Promise<{ count: number; expenses: ExpenseItem[] }> => {
            const { data, error } = await api.api.private.expenses.get({
                query: {
                    page: 1,
                    limit: 20,
                    searchQuery: "",
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    includeDeleted: false,
                    ...params,
                },
            });
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as { count: number; expenses: ExpenseItem[] };
        },
    });

export const expenseDetailQueryOptions = (id: number) =>
    queryOptions({
        queryKey: expenseKeys.detail(id),
        queryFn: async (): Promise<ExpenseItem> => {
            const { data, error } = await api.api.private.expenses({ id }).get();
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as ExpenseItem;
        },
        enabled: id > 0,
    });

// --- Mutation functions (exported for testing) ---

export const createExpenseFn = async (body: {
    name: string;
    amount: number;
    description: string | null;
    expenseDate: string;
}) => {
    const { data, error } = await api.api.private.expenses.post(body);
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as ExpenseItem;
};

export const updateExpenseFn = async ({
    id,
    ...body
}: {
    id: number;
    name?: string;
    amount?: number;
    description?: string | null;
    expenseDate?: string;
}) => {
    const { data, error } = await api.api.private.expenses({ id }).patch(body);
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as ExpenseItem;
};

export const deleteExpenseFn = async (id: number) => {
    const { data, error } = await api.api.private.expenses({ id }).delete();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as ExpenseItem;
};

export const restoreExpenseFn = async (id: number) => {
    const { data, error } = await api.api.private.expenses({ id }).restore.post();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as ExpenseItem;
};

// --- Hooks ---

export const useCreateExpense = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createExpenseFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: expenseKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useUpdateExpense = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateExpenseFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: expenseKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useDeleteExpense = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteExpenseFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: expenseKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useRestoreExpense = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: restoreExpenseFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: expenseKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};
