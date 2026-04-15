import { createFileRoute, redirect } from "@tanstack/react-router";
import z from "zod";

import { hasPermission, Permission } from "@jahonbozor/schemas";

import { createOrderFn, orderKeys } from "@/api/orders.api";
import { queryClient } from "@/lib/query-client";
import { useAuthStore } from "@/stores/auth.store";

const newOrderSearchSchema = z.object({
    userId: z.coerce.number().optional(),
});

export const Route = createFileRoute("/_dashboard/orders/new")({
    validateSearch: (search) => newOrderSearchSchema.parse(search),
    beforeLoad: async ({ search }) => {
        const { permissions } = useAuthStore.getState();
        if (!hasPermission(permissions, Permission.ORDERS_CREATE)) {
            throw redirect({ to: "/" });
        }

        const order = await createOrderFn({
            userId: search.userId ?? null,
            paymentType: "CASH",
            type: "LIST",
            items: [],
        });

        void queryClient.invalidateQueries({ queryKey: orderKeys.all });

        throw redirect({
            to: "/orders/$orderId",
            params: { orderId: String(order.id) },
            replace: true,
        });
    },
});
