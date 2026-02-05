import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import { Permission } from "@jahonbozor/schemas";
import {
    CreateOrderBody,
    UpdateOrderBody,
    OrdersPagination,
} from "@jahonbozor/schemas/src/orders";
import logger from "@lib/logger";
import { authMiddleware } from "@lib/middleware";
import { Elysia, t } from "elysia";
import { OrdersService } from "./orders.service";

const orderIdParams = t.Object({
    id: t.Numeric(),
});

export const orders = new Elysia({ prefix: "/orders" })
    .use(authMiddleware)
    .get(
        "/",
        async ({ query, user, permissions }): Promise<ReturnSchema> => {
            try {
                return await OrdersService.getAllOrders(query, user.id, permissions);
            } catch (error) {
                logger.error("Orders: Unhandled error in GET /orders", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.ORDERS_LIST_OWN],
            query: OrdersPagination,
        },
    )
    .get(
        "/:id",
        async ({ params, user, permissions, set }): Promise<ReturnSchema> => {
            try {
                const result = await OrdersService.getOrder(params.id, user.id, permissions);

                if (!result.success) {
                    set.status = result.error === "Forbidden" ? 403 : 404;
                }

                return result;
            } catch (error) {
                logger.error("Orders: Unhandled error in GET /:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.ORDERS_READ_OWN],
            params: orderIdParams,
        },
    )
    .post(
        "/",
        async ({ body, user, set }): Promise<ReturnSchema> => {
            try {
                const result = await OrdersService.createOrder(body, user.id);

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Orders: Unhandled error in POST /orders", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.ORDERS_CREATE],
            body: CreateOrderBody,
        },
    )
    .patch(
        "/:id",
        async ({ params, body, user, permissions, set }): Promise<ReturnSchema> => {
            try {
                const result = await OrdersService.updateOrder(
                    params.id,
                    body,
                    user.id,
                    permissions,
                );

                if (!result.success) {
                    set.status = result.error === "Forbidden" ? 403 : 404;
                }

                return result;
            } catch (error) {
                logger.error("Orders: Unhandled error in PATCH /:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.ORDERS_UPDATE_OWN],
            params: orderIdParams,
            body: UpdateOrderBody,
        },
    )
    .delete(
        "/:id",
        async ({ params, user, set }): Promise<ReturnSchema> => {
            try {
                const result = await OrdersService.deleteOrder(params.id, user.id);

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error("Orders: Unhandled error in DELETE /:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.ORDERS_DELETE],
            params: orderIdParams,
        },
    );
