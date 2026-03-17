import { Elysia } from "elysia";

import { authMiddleware } from "@backend/lib/middleware";

import { PublicDebtsService } from "./debts.service";

import type { DebtPaymentsListResponse, DebtSummaryResponse } from "@jahonbozor/schemas/src/debts";

export const publicDebts = new Elysia({ prefix: "/debts" })
    .use(authMiddleware)
    .get(
        "/summary",
        async ({ user, type, set, logger }): Promise<DebtSummaryResponse> => {
            try {
                if (type !== "user") {
                    set.status = 403;
                    return { success: false, error: "Only users can access this endpoint" };
                }

                return await PublicDebtsService.getMyDebtSummary(user.id, logger);
            } catch (error) {
                logger.error("PublicDebts: Unhandled error in GET /debts/summary", { error });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        {
            auth: true,
        },
    )
    .get(
        "/payments",
        async ({ user, type, set, logger }): Promise<DebtPaymentsListResponse> => {
            try {
                if (type !== "user") {
                    set.status = 403;
                    return { success: false, error: "Only users can access this endpoint" };
                }

                return await PublicDebtsService.getMyDebtPayments(user.id, logger);
            } catch (error) {
                logger.error("PublicDebts: Unhandled error in GET /debts/payments", { error });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        {
            auth: true,
        },
    );
