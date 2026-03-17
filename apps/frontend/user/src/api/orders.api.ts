import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@jahonbozor/ui";

import { api } from "@/lib/api-client";
import { unwrap } from "@/lib/eden-utils";
import { i18n } from "@/lib/i18n";
import { useCartStore } from "@/stores/cart.store";

import type { UserOrderItem } from "@jahonbozor/schemas/src/orders";

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
        queryFn: async (): Promise<{ count: number; orders: UserOrderItem[] }> =>
            unwrap(
                await api.api.public.orders.get({
                    query: {
                        page: params.page ?? 1,
                        limit: params.limit ?? 20,
                        searchQuery: "",
                        sortBy: "id",
                        sortOrder: "asc" as const,
                        status: params.status,
                    },
                }),
            ),
    });

export const orderDetailOptions = (id: number) =>
    queryOptions({
        queryKey: orderKeys.detail(id),
        queryFn: async (): Promise<UserOrderItem> =>
            unwrap(await api.api.public.orders({ id }).get()),
    });

export function useCreateOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (body: {
            paymentType: "CASH" | "CREDIT_CARD" | "DEBT";
            comment?: string | null;
            items: { productId: number; quantity: number; price: number }[];
        }): Promise<UserOrderItem> => unwrap(await api.api.public.orders.post(body)),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
            useCartStore.getState().clearCart();
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
}

export function useCancelOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (orderId: number): Promise<UserOrderItem> =>
            unwrap(await api.api.public.orders({ id: orderId }).cancel.patch()),
        onSuccess: (_data, orderId) => {
            void queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
            void queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
}
