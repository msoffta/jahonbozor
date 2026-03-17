import { Elysia, t } from "elysia";

import { Permission } from "@jahonbozor/schemas";
import { CreateDebtPaymentBody } from "@jahonbozor/schemas/src/debts";

import { authMiddleware } from "@backend/lib/middleware";

import { DebtsService } from "./debts.service";

import type {
    DebtOrdersResponse,
    DebtPaymentResponse,
    DebtPaymentsListResponse,
    DebtSummaryResponse,
} from "@jahonbozor/schemas/src/debts";

const userIdParams = t.Object({
    userId: t.Numeric(),
});

const orderIdParams = t.Object({
    orderId: t.Numeric(),
});

export const debts = new Elysia({ prefix: "/debts" })
    .use(authMiddleware)
    .get(
        "/users/:userId/summary",
        async ({ params, logger }): Promise<DebtSummaryResponse> => {
            try {
                return await DebtsService.getUserDebtSummary(params.userId, logger);
            } catch (error) {
                logger.error("Debts: Unhandled error in GET /debts/users/:userId/summary", {
                    userId: params.userId,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.DEBTS_READ],
            params: userIdParams,
        },
    )
    .get(
        "/users/:userId/orders",
        async ({ params, logger }): Promise<DebtOrdersResponse> => {
            try {
                return await DebtsService.getDebtOrders(params.userId, logger);
            } catch (error) {
                logger.error("Debts: Unhandled error in GET /debts/users/:userId/orders", {
                    userId: params.userId,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.DEBTS_LIST],
            params: userIdParams,
        },
    )
    .post(
        "/orders/:orderId/payments",
        async ({ params, body, user, set, logger, requestId }): Promise<DebtPaymentResponse> => {
            try {
                const result = await DebtsService.createDebtPayment(
                    params.orderId,
                    body,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = result.error === "Order not found" ? 404 : 400;
                }

                return result;
            } catch (error) {
                logger.error("Debts: Unhandled error in POST /debts/orders/:orderId/payments", {
                    orderId: params.orderId,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.DEBTS_CREATE_PAYMENT],
            params: orderIdParams,
            body: CreateDebtPaymentBody,
        },
    )
    .get(
        "/orders/:orderId/payments",
        async ({ params, logger }): Promise<DebtPaymentsListResponse> => {
            try {
                return await DebtsService.getDebtPayments(params.orderId, logger);
            } catch (error) {
                logger.error("Debts: Unhandled error in GET /debts/orders/:orderId/payments", {
                    orderId: params.orderId,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.DEBTS_READ],
            params: orderIdParams,
        },
    );
