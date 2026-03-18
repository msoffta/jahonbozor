import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@jahonbozor/ui";

import { api } from "@/api/client";
import { i18n } from "@/i18n/config";

import type { AdminOrderItem } from "@jahonbozor/schemas/src/orders";

interface InsufficientStockDetail {
    productName: string;
    requested: number;
    available: number;
}

function handleOrderError(error: unknown) {
    const err = error as { code?: string; details?: InsufficientStockDetail[] } | undefined;
    if (err?.code === "INSUFFICIENT_STOCK" && Array.isArray(err.details)) {
        const lines = err.details.map((d) => `${d.productName}: ${d.requested}/${d.available}`);
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
    itemsCount?: number;
    minItemsCount?: number;
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
    items?: { productId: number; quantity: number; price: number }[];
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
    items: { productId: number; quantity: number; price: number }[];
}) => {
    const { data, error } = await api.api.private.orders.post(body);
    if (error) throw error;
    if (!data.success) throw data.error;
    return data.data as AdminOrderItem;
};

export function useCreateOrder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createOrderFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: orderKeys.all });
        },
        onError: handleOrderError,
    });
}

export function useUpdateOrder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateOrderFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: orderKeys.all });
        },
        onError: handleOrderError,
    });
}

export function useDeleteOrder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteOrderFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: orderKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
}
