import {
    infiniteQueryOptions,
    queryOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";

import { toast } from "@jahonbozor/ui";

import { api } from "@/api/client";
import { i18n } from "@/i18n/config";

import type { AdminOrderItem } from "@jahonbozor/schemas/src/orders";

interface OrdersInfiniteCache {
    pages: { count: number; orders: AdminOrderItem[] }[];
    pageParams: number[];
}

function getBusinessError(error: unknown): Record<string, unknown> | undefined {
    const value = (error as { value?: { error?: Record<string, unknown> } })?.value?.error;
    if (value) return value;
    const raw = error as Record<string, unknown> | undefined;
    return raw?.code ? raw : undefined;
}

function handleOrderError(error: unknown) {
    const err = getBusinessError(error);
    if (err?.code === "INSUFFICIENT_STOCK" && Array.isArray(err.details)) {
        const details = err.details as {
            productName: string;
            requested: number;
            available: number;
        }[];
        const lines = details.map((d) =>
            i18n.t("orders:insufficient_stock_detail", {
                name: d.productName,
                requested: d.requested,
                available: d.available,
            }),
        );
        toast.error(`${i18n.t("orders:insufficient_stock")}\n${lines.join("\n")}`);
        return;
    }
    toast.error(i18n.t("error"));
}

export const orderKeys = {
    all: ["orders"] as const,
    lists: () => [...orderKeys.all, "list"] as const,
    list: (params?: Record<string, unknown>) => [...orderKeys.lists(), params] as const,
    details: () => [...orderKeys.all, "detail"] as const,
    detail: (id: number) => [...orderKeys.details(), id] as const,
};

export const ordersListQueryOptions = (params?: {
    page?: number;
    limit?: number;
    searchQuery?: string;
    userId?: number;
    staffId?: number;
    paymentType?: "CASH" | "CREDIT_CARD" | "DEBT";
    dateFrom?: string;
    dateTo?: string;
    type?: "ORDER" | "LIST";
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}) =>
    queryOptions({
        queryKey: orderKeys.list(params),
        queryFn: async (): Promise<{
            count: number;
            orders: AdminOrderItem[];
        }> => {
            const { data, error } = await api.api.private.orders.get({
                query: {
                    page: 1,
                    limit: 20,
                    searchQuery: "",
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    ...params,
                },
            });
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as { count: number; orders: AdminOrderItem[] };
        },
    });

export const ordersInfiniteQueryOptions = (params?: {
    limit?: number;
    searchQuery?: string;
    userId?: number;
    staffId?: number;
    paymentType?: "CASH" | "CREDIT_CARD" | "DEBT";
    dateFrom?: string;
    dateTo?: string;
    type?: "ORDER" | "LIST";
}) =>
    infiniteQueryOptions({
        queryKey: orderKeys.list({ ...params, infinite: true }),
        queryFn: async ({
            pageParam,
        }): Promise<{
            count: number;
            orders: AdminOrderItem[];
        }> => {
            const { data, error } = await api.api.private.orders.get({
                query: {
                    page: pageParam,
                    limit: params?.limit ?? 10000,
                    searchQuery: "",
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    ...params,
                },
            });
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as { count: number; orders: AdminOrderItem[] };
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage, _allPages, lastPageParam) => {
            const loaded = lastPageParam * (params?.limit ?? 10000);
            return loaded < lastPage.count ? lastPageParam + 1 : undefined;
        },
    });

export const orderDetailQueryOptions = (id: number) =>
    queryOptions({
        queryKey: orderKeys.detail(id),
        queryFn: async (): Promise<AdminOrderItem> => {
            const { data, error } = await api.api.private.orders({ id }).get();
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as AdminOrderItem;
        },
        enabled: id > 0,
    });

export const updateOrderFn = async ({
    id,
    ...body
}: {
    id: number;
    paymentType?: "CASH" | "CREDIT_CARD" | "DEBT";
    comment?: string | null;
    userId?: number | null;
    items?: { productId: number | null; quantity: number; price: number }[];
}) => {
    const { data, error } = await api.api.private.orders({ id }).patch(body);
    if (error) throw error;
    if (!data.success) throw data.error;
    return data.data as AdminOrderItem;
};

export const deleteOrderFn = async (id: number) => {
    const { data, error } = await api.api.private.orders({ id }).delete();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data;
};

export const createOrderFn = async (body: {
    userId?: number | null;
    paymentType: "CASH" | "CREDIT_CARD" | "DEBT";
    comment?: string | null;
    type?: "ORDER" | "LIST";
    items: { productId: number | null; quantity: number; price: number }[];
}) => {
    const { data, error } = await api.api.private.orders.post(body);
    if (error) throw error;
    if (!data.success) throw data.error;
    return data.data as AdminOrderItem;
};

export function useCreateOrder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["orders", "create"],
        mutationFn: createOrderFn,
        onSuccess: (newOrder) => {
            queryClient.setQueriesData<OrdersInfiniteCache>({ queryKey: orderKeys.all }, (old) => {
                if (!old?.pages?.length) return old;
                const lastIdx = old.pages.length - 1;
                return {
                    ...old,
                    pages: old.pages.map((page, index) =>
                        index === lastIdx
                            ? {
                                  count: page.count + 1,
                                  orders: [...page.orders, newOrder],
                              }
                            : page,
                    ),
                };
            });
            queryClient.setQueryData(orderKeys.detail(newOrder.id), newOrder);
        },
        onError: handleOrderError,
    });
}

export function useUpdateOrder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["orders", "update"],
        mutationFn: updateOrderFn,
        onSuccess: (updatedOrder) => {
            queryClient.setQueriesData<OrdersInfiniteCache>({ queryKey: orderKeys.all }, (old) => {
                if (!old?.pages?.length) return old;
                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        orders: page.orders.map((o) =>
                            o.id === updatedOrder.id ? updatedOrder : o,
                        ),
                    })),
                };
            });
            queryClient.setQueryData(orderKeys.detail(updatedOrder.id), updatedOrder);
        },
        onError: handleOrderError,
    });
}

export function useDeleteOrder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["orders", "delete"],
        mutationFn: deleteOrderFn,
        onSuccess: (result) => {
            const deletedId = result?.orderId;
            if (deletedId == null) return;
            queryClient.setQueriesData<OrdersInfiniteCache>({ queryKey: orderKeys.all }, (old) => {
                if (!old?.pages?.length) return old;
                return {
                    ...old,
                    pages: old.pages.map((page) => {
                        const filtered = page.orders.filter((o) => o.id !== deletedId);
                        return {
                            count: Math.max(0, page.count - (page.orders.length - filtered.length)),
                            orders: filtered,
                        };
                    }),
                };
            });
            queryClient.removeQueries({ queryKey: orderKeys.detail(deletedId) });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
}

export const restoreOrderFn = async (id: number) => {
    const { data, error } = await api.api.private.orders({ id }).restore.post();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data;
};

export function useRestoreOrder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["orders", "restore"],
        mutationFn: restoreOrderFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: orderKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
}
