import { Elysia, t } from "elysia";

import { Permission } from "@jahonbozor/schemas";
import {
    CreateExpenseBody,
    ExpensesPagination,
    UpdateExpenseBody,
} from "@jahonbozor/schemas/src/expenses";

import { authMiddleware } from "@backend/lib/middleware";

import { ExpensesService } from "./expenses.service";

import type { ExpenseDetailResponse, ExpensesListResponse } from "@jahonbozor/schemas/src/expenses";

const expenseIdParams = t.Object({
    id: t.Numeric(),
});

export const expenses = new Elysia({ prefix: "/expenses" })
    .use(authMiddleware)
    .get(
        "/",
        async ({ query, logger }): Promise<ExpensesListResponse> => {
            try {
                return await ExpensesService.getAllExpenses(query, logger);
            } catch (error) {
                logger.error("Expenses: Unhandled error in GET /expenses", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.EXPENSES_LIST],
            query: ExpensesPagination,
        },
    )
    .get(
        "/:id",
        async ({ params, set, logger }): Promise<ExpenseDetailResponse> => {
            try {
                const result = await ExpensesService.getExpense(params.id, logger);

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error("Expenses: Unhandled error in GET /expenses/:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.EXPENSES_READ],
            params: expenseIdParams,
        },
    )
    .post(
        "/",
        async ({ body, user, set, logger, requestId }): Promise<ExpenseDetailResponse> => {
            try {
                const result = await ExpensesService.createExpense(
                    body,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Expenses: Unhandled error in POST /expenses", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.EXPENSES_CREATE],
            body: CreateExpenseBody,
        },
    )
    .patch(
        "/:id",
        async ({ params, body, user, set, logger, requestId }): Promise<ExpenseDetailResponse> => {
            try {
                const result = await ExpensesService.updateExpense(
                    params.id,
                    body,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Expenses: Unhandled error in PATCH /expenses/:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.EXPENSES_UPDATE],
            params: expenseIdParams,
            body: UpdateExpenseBody,
        },
    )
    .delete(
        "/:id",
        async ({ params, user, set, logger, requestId }): Promise<ExpenseDetailResponse> => {
            try {
                const result = await ExpensesService.deleteExpense(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Expenses: Unhandled error in DELETE /expenses/:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.EXPENSES_DELETE],
            params: expenseIdParams,
        },
    )
    .post(
        "/:id/restore",
        async ({ params, user, set, logger, requestId }): Promise<ExpenseDetailResponse> => {
            try {
                const result = await ExpensesService.restoreExpense(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Expenses: Unhandled error in POST /expenses/:id/restore", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.EXPENSES_UPDATE],
            params: expenseIdParams,
        },
    );
