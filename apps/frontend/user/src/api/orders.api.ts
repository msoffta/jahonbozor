import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UserOrderItem } from "@jahonbozor/schemas/src/orders";
import { api } from "@/lib/api-client";
import { useCartStore } from "@/stores/cart.store";

export const orderKeys = {
    all: ["orders"] as const,
    lists: () => [...orderKeys.all, "list"] as const,
    list: (params: Record<string, unknown>) => [...orderKeys.lists(), params] as const,
    details: () => [...orderKeys.all, "detail"] as const,
    detail: (id: number) => [...orderKeys.details(), id] as const,
};

export const ordersListOptions = (params: {
    page?: number;
    limit?: number;
    status?: "NEW" | "ACCEPTED" | "CANCELLED";
}) =>
    queryOptions({
        queryKey: orderKeys.list(params),
        queryFn: async (): Promise<{ count: number; orders: UserOrderItem[] }> => {
            const { data, error } = await api.api.public.orders.get({
                query: {
                    page: params.page ?? 1,
                    limit: params.limit ?? 20,
                    searchQuery: "",
                    status: params.status,
                },
            });
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data;
        },
    });

export const orderDetailOptions = (id: number) =>
    queryOptions({
        queryKey: orderKeys.detail(id),
        queryFn: async (): Promise<UserOrderItem> => {
            const { data, error } = await api.api.public.orders({ id }).get();
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data;
        },
    });

export function useCreateOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (body: {
            paymentType: "CASH" | "CREDIT_CARD";
            items: Array<{ productId: number; quantity: number; price: number }>;
        }): Promise<UserOrderItem> => {
            const { data, error } = await api.api.public.orders.post(body);
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
            useCartStore.getState().clearCart();
        },
    });
}

export function useCancelOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (orderId: number): Promise<UserOrderItem> => {
            const { data, error } = await api.api.public.orders({ id: orderId }).cancel.patch();
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data;
        },
        onSuccess: (_data, orderId) => {
            queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
            queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
        },
    });
}
