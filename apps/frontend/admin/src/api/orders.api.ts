import { api } from "@/api/client";
import type { AdminOrderItem } from "@jahonbozor/schemas/src/orders";
import {
    queryOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";

export const orderKeys = {
    all: ["orders"] as const,
    list: (params?: Record<string, unknown>) =>
        [...orderKeys.all, "list", params] as const,
    detail: (id: number) => [...orderKeys.all, "detail", id] as const,
};

export const ordersListQueryOptions = (params?: {
    page?: number;
    limit?: number;
    searchQuery?: string;
    userId?: number;
    staffId?: number;
    paymentType?: "CASH" | "CREDIT_CARD" | "DEBT";
    status?: "NEW" | "ACCEPTED" | "CANCELLED";
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
                query: { page: 1, limit: 20, searchQuery: "", ...params },
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
    status?: "NEW" | "ACCEPTED" | "CANCELLED";
    paymentType?: "CASH" | "CREDIT_CARD" | "DEBT";
    comment?: string | null;
    data?: any;
}) => {
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

export const createOrderFn = async (body: {
    userId?: number | null;
    paymentType: "CASH" | "CREDIT_CARD" | "DEBT";
    comment?: string | null;
    items: { productId: number; quantity: number; price: number }[];
}) => {
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
