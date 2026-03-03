import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ExpenseItem } from "@jahonbozor/schemas/src/expenses";
import { api } from "@/api/client";

export const expenseKeys = {
    all: ["expenses"] as const,
    list: (params?: Record<string, unknown>) => [...expenseKeys.all, "list", params] as const,
    detail: (id: number) => [...expenseKeys.all, "detail", id] as const,
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
                query: { page: 1, limit: 20, searchQuery: "", includeDeleted: false, ...params },
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

export const useCreateExpense = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (body: { name: string; amount: number; description: string | null; expenseDate: string }) => {
            const { data, error } = await api.api.private.expenses.post(body);
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as ExpenseItem;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: expenseKeys.all });
        },
    });
};

export const useUpdateExpense = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...body }: { id: number; name?: string; amount?: number; description?: string | null; expenseDate?: string }) => {
            const { data, error } = await api.api.private.expenses({ id }).patch(body);
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as ExpenseItem;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: expenseKeys.all });
        },
    });
};

export const useDeleteExpense = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: number) => {
            const { data, error } = await api.api.private.expenses({ id }).delete();
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as ExpenseItem;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: expenseKeys.all });
        },
    });
};

export const useRestoreExpense = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: number) => {
            const { data, error } = await api.api.private.expenses({ id }).restore.post();
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as ExpenseItem;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: expenseKeys.all });
        },
    });
};
