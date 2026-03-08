import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AdminOrderItem } from "@jahonbozor/schemas/src/orders";
import { api } from "@/api/client";

export const orderKeys = {
    all: ["orders"] as const,
    list: (params?: Record<string, unknown>) => [...orderKeys.all, "list", params] as const,
    detail: (id: number) => [...orderKeys.all, "detail", id] as const,
};

export const ordersListQueryOptions = (params?: {
    page?: number;
    limit?: number;
    searchQuery?: string;
    userId?: number;
    staffId?: number;
    paymentType?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    itemsCount?: number;
}) =>
    queryOptions({
        queryKey: orderKeys.list(params),
        queryFn: async (): Promise<{ count: number; orders: AdminOrderItem[] }> => {
            const { data, error } = await api.api.private.orders.get({
                query: { page: 1, limit: 20, ...params },
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

export const updateOrderFn = async ({ id, ...body }: { id: number; status?: string; paymentType?: string; data?: any }) => {
    const { data, error } = await api.api.private.orders({ id }).patch(body);
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as AdminOrderItem;
};

export const deleteOrderFn = async (id: number) => {
    const { data, error } = await api.api.private.orders({ id }).delete();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data;
};

export const createOrderFn = async (body: { userId?: number | null; paymentType: string; items: { productId: number; quantity: number }[] }) => {
    const { data, error } = await api.api.private.orders.post(body);
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as AdminOrderItem;
};

export function useCreateOrder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createOrderFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: orderKeys.all });
        },
    });
}

export function useUpdateOrder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateOrderFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: orderKeys.all });
        },
    });
}

export function useDeleteOrder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteOrderFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: orderKeys.all });
        },
    });
}
