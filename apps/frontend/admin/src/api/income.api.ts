import {
    infiniteQueryOptions,
    queryOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";

import { toast } from "@jahonbozor/ui";

import { api } from "@/api/client";
import { productKeys } from "@/api/products.api";
import { i18n } from "@/i18n/config";

import type { HistoryEntryItem } from "@jahonbozor/schemas/src/products/product-history.dto";

interface IncomeInfiniteCache {
    pages: { count: number; history: HistoryEntryItem[] }[];
    pageParams: number[];
}

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
                    sortBy: "id",
                    sortOrder: "asc" as const,
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

export const incomeInfiniteQueryOptions = (params?: {
    limit?: number;
    searchQuery?: string;
    staffId?: number;
    productId?: number;
    dateFrom?: string;
    dateTo?: string;
}) =>
    infiniteQueryOptions({
        queryKey: incomeKeys.list({ ...params, infinite: true }),
        queryFn: async ({
            pageParam,
        }): Promise<{
            count: number;
            history: HistoryEntryItem[];
        }> => {
            const { data, error } = await api.api.private.products.history.get({
                query: {
                    operation: "INVENTORY_ADD",
                    page: pageParam,
                    limit: params?.limit ?? 10000,
                    searchQuery: params?.searchQuery ?? "",
                    sortBy: "id",
                    sortOrder: "asc" as const,
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
        initialPageParam: 1,
        getNextPageParam: (lastPage, _allPages, lastPageParam) => {
            const loaded = lastPageParam * (params?.limit ?? 10000);
            return loaded < lastPage.count ? lastPageParam + 1 : undefined;
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

export const deleteIncomeFn = async (historyId: number) => {
    const { data, error } = await api.api.private.products.history({ historyId }).delete();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data;
};

export const useDeleteIncome = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["income", "delete"],
        mutationFn: deleteIncomeFn,
        onSuccess: (deletedEntry) => {
            const deletedId = (deletedEntry as HistoryEntryItem | undefined)?.id;
            if (deletedId != null) {
                queryClient.setQueriesData<IncomeInfiniteCache>(
                    { queryKey: incomeKeys.all },
                    (old) => {
                        if (!old?.pages?.length) return old;
                        return {
                            ...old,
                            pages: old.pages.map((page) => {
                                const filtered = page.history.filter((h) => h.id !== deletedId);
                                return {
                                    count: Math.max(
                                        0,
                                        page.count - (page.history.length - filtered.length),
                                    ),
                                    history: filtered,
                                };
                            }),
                        };
                    },
                );
            }
            // Cross-domain: deleting an income entry affects product.remaining.
            // Own income cache is patched optimistically above; product list is
            // on a different page so invalidating is safe (no flicker on this screen).
            queryClient.invalidateQueries({ queryKey: productKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useCreateIncome = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["income", "create"],
        mutationFn: createIncomeFn,
        onSuccess: (result) => {
            const historyEntry = (result as { historyEntry?: HistoryEntryItem } | undefined)
                ?.historyEntry;
            if (historyEntry) {
                queryClient.setQueriesData<IncomeInfiniteCache>(
                    { queryKey: incomeKeys.all },
                    (old) => {
                        if (!old?.pages?.length) return old;
                        const lastIdx = old.pages.length - 1;
                        return {
                            ...old,
                            pages: old.pages.map((page, index) =>
                                index === lastIdx
                                    ? {
                                          count: page.count + 1,
                                          history: [...page.history, historyEntry],
                                      }
                                    : page,
                            ),
                        };
                    },
                );
            }
            // Cross-domain: creating an income entry changes product.remaining.
            // The products list is not visible on the income page, so invalidating
            // it here doesn't cause any visible flicker on the current screen.
            queryClient.invalidateQueries({ queryKey: productKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};
