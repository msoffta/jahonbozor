import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import { CreateOrderBody, OrdersPagination } from "@jahonbozor/schemas/src/orders";
import { authMiddleware } from "@lib/middleware";
import { Elysia, t } from "elysia";
import { PublicOrdersService } from "./orders.service";

const orderIdParams = t.Object({
    id: t.Numeric(),
});

export const publicOrders = new Elysia({ prefix: "/orders" })
    .use(authMiddleware)
    .post(
        "/",
        async ({ body, user, type, set, logger, requestId }): Promise<ReturnSchema> => {
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
                return { success: false, error };
            }
        },
        {
            auth: true,
            body: CreateOrderBody,
        },
    )
    .get(
        "/",
        async ({ query, user, type, set, logger }): Promise<ReturnSchema> => {
            try {
                if (type !== "user") {
                    set.status = 403;
                    return { success: false, error: "Only users can access this endpoint" };
                }

                return await PublicOrdersService.getUserOrders(user.id, query, logger);
            } catch (error) {
                logger.error("PublicOrders: Unhandled error in GET /orders", { error });
                return { success: false, error };
            }
        },
        {
            auth: true,
            query: OrdersPagination,
        },
    )
    .get(
        "/:id",
        async ({ params, user, type, set, logger }): Promise<ReturnSchema> => {
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
                return { success: false, error };
            }
        },
        {
            auth: true,
            params: orderIdParams,
        },
    );
