import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@jahonbozor/ui";

import { api } from "@/api/client";
import { productKeys } from "@/api/products.api";
import { i18n } from "@/i18n/config";

import type { HistoryEntryItem } from "@jahonbozor/schemas/src/products/product-history.dto";

export const incomeKeys = {
    all: ["income"] as const,
    lists: () => [...incomeKeys.all, "list"] as const,
    list: (params?: Record<string, unknown>) => [...incomeKeys.lists(), params] as const,
};

export const incomeListQueryOptions = (params?: {
    page?: number;
    limit?: number;
    searchQuery?: string;
    staffId?: number;
    productId?: number;
    dateFrom?: string;
    dateTo?: string;
}) =>
    queryOptions({
        queryKey: incomeKeys.list(params),
        queryFn: async (): Promise<{
            count: number;
            history: HistoryEntryItem[];
        }> => {
            const { data, error } = await api.api.private.products.history.get({
                query: {
                    operation: "INVENTORY_ADD",
                    page: params?.page ?? 1,
                    limit: params?.limit ?? 20,
                    searchQuery: params?.searchQuery ?? "",
                    staffId: params?.staffId,
                    productId: params?.productId,
                    dateFrom: params?.dateFrom,
                    dateTo: params?.dateTo,
                },
            });
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as { count: number; history: HistoryEntryItem[] };
        },
    });

export const createIncomeFn = async (body: {
    productId: number;
    quantity: number;
    changeReason?: string | null;
    createdAt?: string;
}) => {
    const { data, error } = await api.api.private.products({ id: body.productId }).inventory.post({
        operation: "INVENTORY_ADD",
        quantity: body.quantity,
        changeReason: body.changeReason ?? null,
        createdAt: body.createdAt,
    });
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data;
};

export const useCreateIncome = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createIncomeFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: incomeKeys.all });
            queryClient.invalidateQueries({ queryKey: productKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};
