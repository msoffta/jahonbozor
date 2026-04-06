import { Elysia, t } from "elysia";

import { Permission } from "@jahonbozor/schemas";
import { CreateOrderBody, OrdersPagination, UpdateOrderBody } from "@jahonbozor/schemas/src/orders";

import { authMiddleware } from "@backend/lib/middleware";

import { OrdersService } from "./orders.service";

import type {
    AdminOrderDeleteResponse,
    AdminOrderDetailResponse,
    AdminOrdersListResponse,
} from "@jahonbozor/schemas/src/orders";

const orderIdParams = t.Object({
    id: t.Numeric(),
});

export const orders = new Elysia({ prefix: "/orders" })
    .use(authMiddleware)
    .get(
        "/",
        async ({ query, user, permissions, logger }): Promise<AdminOrdersListResponse> => {
            try {
                return await OrdersService.getAllOrders(query, user.id, permissions, logger);
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
        async ({ params, user, permissions, set, logger }): Promise<AdminOrderDetailResponse> => {
            try {
                const result = await OrdersService.getOrder(
                    params.id,
                    user.id,
                    permissions,
                    logger,
                );

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
        async ({ body, user, set, logger, requestId }): Promise<AdminOrderDetailResponse> => {
            try {
                const result = await OrdersService.createOrder(
                    body,
                    { staffId: user.id, user, requestId },
                    logger,
                );

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
        async ({
            params,
            body,
            user,
            permissions,
            set,
            logger,
            requestId,
        }): Promise<AdminOrderDetailResponse> => {
            try {
                const result = await OrdersService.updateOrder(
                    params.id,
                    body,
                    { staffId: user.id, user, requestId },
                    permissions,
                    logger,
                );

                if (!result.success) {
                    if (result.error === "Forbidden") {
                        set.status = 403;
                    } else if (result.error === "Order not found") {
                        set.status = 404;
                    } else {
                        set.status = 400;
                    }
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
        async ({ params, user, set, logger, requestId }): Promise<AdminOrderDeleteResponse> => {
            try {
                const result = await OrdersService.deleteOrder(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

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
    )
    .post(
        "/:id/finalize",
        async ({
            params,
            user,
            permissions,
            set,
            logger,
            requestId,
        }): Promise<AdminOrderDetailResponse> => {
            try {
                const result = await OrdersService.finalizeDraft(
                    params.id,
                    { staffId: user.id, user, requestId },
                    permissions,
                    logger,
                );

                if (!result.success) {
                    const error = typeof result.error === "string" ? result.error : "";
                    if (error === "Forbidden") {
                        set.status = 403;
                    } else if (error === "Order not found") {
                        set.status = 404;
                    } else {
                        set.status = 400;
                    }
                }

                return result;
            } catch (error) {
                logger.error("Orders: Unhandled error in POST /:id/finalize", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.ORDERS_CREATE],
            params: orderIdParams,
        },
    )
    .post(
        "/:id/restore",
        async ({ params, user, set, logger, requestId }): Promise<AdminOrderDeleteResponse> => {
            try {
                const result = await OrdersService.restoreOrder(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    const error = typeof result.error === "string" ? result.error : "";
                    if (error.includes("not found")) {
                        set.status = 404;
                    } else if (error.includes("not deleted")) {
                        set.status = 400;
                    } else {
                        set.status = 500;
                    }
                }

                return result;
            } catch (error) {
                logger.error("Orders: Unhandled error in POST /:id/restore", {
                    id: params.id,
                    error,
                });
                set.status = 500;
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.ORDERS_DELETE],
            params: orderIdParams,
        },
    );
