import { Elysia, t } from "elysia";

import { CreateOrderBody, OrdersPagination } from "@jahonbozor/schemas/src/orders";

import { authMiddleware } from "@backend/lib/middleware";

import { PublicOrdersService } from "./orders.service";

import type {
    UserOrderCancelResponse,
    UserOrderCreateResponse,
    UserOrderDetailResponse,
    UserOrdersListResponse,
} from "@jahonbozor/schemas/src/orders";

const orderIdParams = t.Object({
    id: t.Numeric(),
});

export const publicOrders = new Elysia({ prefix: "/orders" })
    .use(authMiddleware)
    .post(
        "/",
        async ({ body, user, type, set, logger, requestId }): Promise<UserOrderCreateResponse> => {
            try {
                if (type !== "user") {
                    set.status = 403;
                    return { success: false, error: "Only users can create orders via public API" };
                }

                const result = await PublicOrdersService.createOrder(
                    body,
                    { userId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("PublicOrders: Unhandled error in POST /orders", { error });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        {
            auth: true,
            body: CreateOrderBody,
        },
    )
    .get(
        "/",
        async ({ query, user, type, set, logger }): Promise<UserOrdersListResponse> => {
            try {
                if (type !== "user") {
                    set.status = 403;
                    return { success: false, error: "Only users can access this endpoint" };
                }

                return await PublicOrdersService.getUserOrders(user.id, query, logger);
            } catch (error) {
                logger.error("PublicOrders: Unhandled error in GET /orders", { error });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        {
            auth: true,
            query: OrdersPagination,
        },
    )
    .get(
        "/:id",
        async ({ params, user, type, set, logger }): Promise<UserOrderDetailResponse> => {
            try {
                if (type !== "user") {
                    set.status = 403;
                    return { success: false, error: "Only users can access this endpoint" };
                }

                const result = await PublicOrdersService.getUserOrder(params.id, user.id, logger);

                if (!result.success) {
                    set.status = result.error === "Forbidden" ? 403 : 404;
                }

                return result;
            } catch (error) {
                logger.error("PublicOrders: Unhandled error in GET /orders/:id", {
                    id: params.id,
                    error,
                });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        {
            auth: true,
            params: orderIdParams,
        },
    )
    .patch(
        "/:id/cancel",
        async ({
            params,
            user,
            type,
            set,
            logger,
            requestId,
        }): Promise<UserOrderCancelResponse> => {
            try {
                if (type !== "user") {
                    set.status = 403;
                    return { success: false, error: "Only users can cancel orders via public API" };
                }

                const result = await PublicOrdersService.cancelOrder(
                    params.id,
                    { userId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    if (result.error === "Forbidden") set.status = 403;
                    else if (result.error === "Order not found") set.status = 404;
                    else set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("PublicOrders: Unhandled error in PATCH /orders/:id/cancel", {
                    id: params.id,
                    error,
                });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        {
            auth: true,
            params: orderIdParams,
        },
    );
