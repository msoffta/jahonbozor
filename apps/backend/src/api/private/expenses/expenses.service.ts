import type { ExpensesListResponse, ExpenseDetailResponse } from "@jahonbozor/schemas/src/expenses";
import type {
    CreateExpenseBody,
    UpdateExpenseBody,
    ExpensesPagination,
} from "@jahonbozor/schemas/src/expenses";
import type { Token } from "@jahonbozor/schemas";
import type { Logger } from "@jahonbozor/logger";
import { prisma } from "@backend/lib/prisma";
import { auditInTransaction } from "@backend/lib/audit";
import type { ExpenseModel } from "@backend/generated/prisma/models/Expense";

interface AuditContext {
    staffId: number;
    user: Token;
    requestId?: string;
}

function createExpenseSnapshot(expense: ExpenseModel) {
    return {
        name: expense.name,
        amount: Number(expense.amount),
        description: expense.description,
        expenseDate: expense.expenseDate,
        staffId: expense.staffId,
    };
}

export abstract class ExpensesService {
    static async getAllExpenses(
        params: ExpensesPagination,
        logger: Logger,
    ): Promise<ExpensesListResponse> {
        try {
            const { page, limit, searchQuery, staffId, dateFrom, dateTo, includeDeleted } = params;

            const whereClause: Record<string, unknown> = {};

            if (!includeDeleted) {
                whereClause.deletedAt = null;
            }

            if (searchQuery) {
                whereClause.name = { contains: searchQuery };
            }

            if (staffId) {
                whereClause.staffId = staffId;
            }

            if (dateFrom || dateTo) {
                const expenseDateFilter: Record<string, Date> = {};
                if (dateFrom) {
                    expenseDateFilter.gte = new Date(dateFrom);
                }
                if (dateTo) {
                    expenseDateFilter.lte = new Date(dateTo);
                }
                whereClause.expenseDate = expenseDateFilter;
            }

            const [count, expenses] = await prisma.$transaction([
                prisma.expense.count({ where: whereClause }),
                prisma.expense.findMany({
                    skip: (page - 1) * limit,
                    take: limit,
                    where: whereClause,
                    include: {
                        staff: {
                            select: {
                                id: true,
                                fullname: true,
                            },
                        },
                    },
                    orderBy: { id: "asc" },
                }),
            ]);

            const mapped = expenses.map(e => ({ ...e, amount: Number(e.amount) }));

            return { success: true, data: { count, expenses: mapped } };
        } catch (error) {
            logger.error("Expenses: Error in getAllExpenses", { page: params.page, limit: params.limit, error });
            return { success: false, error };
        }
    }

    static async getExpense(expenseId: number, logger: Logger): Promise<ExpenseDetailResponse> {
        try {
            const expense = await prisma.expense.findUnique({
                where: { id: expenseId },
                include: {
                    staff: {
                        select: {
                            id: true,
                            fullname: true,
                        },
                    },
                },
            });

            if (!expense) {
                logger.warn("Expenses: Expense not found", { expenseId });
                return { success: false, error: "Expense not found" };
            }

            const mapped = { ...expense, amount: Number(expense.amount) };

            return { success: true, data: mapped };
        } catch (error) {
            logger.error("Expenses: Error in getExpense", { expenseId, error });
            return { success: false, error };
        }
    }

    static async createExpense(
        expenseData: CreateExpenseBody,
        context: AuditContext,
        logger: Logger,
    ): Promise<ExpenseDetailResponse> {
        try {
            const [newExpense] = await prisma.$transaction(async (transaction) => {
                const expense = await transaction.expense.create({
                    data: {
                        name: expenseData.name,
                        amount: expenseData.amount,
                        description: expenseData.description ?? null,
                        expenseDate: expenseData.expenseDate,
                        staffId: context.staffId,
                    },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "expense",
                        entityId: expense.id,
                        action: "CREATE",
                        newData: createExpenseSnapshot(expense),
                    },
                );

                return [expense];
            });

            logger.info("Expenses: Expense created", { expenseId: newExpense.id, name: expenseData.name, staffId: context.staffId });
            const mapped = { ...newExpense, amount: Number(newExpense.amount) };
            return { success: true, data: mapped };
        } catch (error) {
            logger.error("Expenses: Error in createExpense", { name: expenseData.name, error });
            return { success: false, error };
        }
    }

    static async updateExpense(
        expenseId: number,
        expenseData: UpdateExpenseBody,
        context: AuditContext,
        logger: Logger,
    ): Promise<ExpenseDetailResponse> {
        try {
            const existingExpense = await prisma.expense.findUnique({
                where: { id: expenseId },
            });

            if (!existingExpense) {
                logger.warn("Expenses: Expense not found for update", { expenseId });
                return { success: false, error: "Expense not found" };
            }

            if (existingExpense.deletedAt) {
                logger.warn("Expenses: Cannot update deleted expense", { expenseId });
                return { success: false, error: "Cannot update deleted expense" };
            }

            const [updatedExpense] = await prisma.$transaction(async (transaction) => {
                const expense = await transaction.expense.update({
                    where: { id: expenseId },
                    data: expenseData,
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "expense",
                        entityId: expenseId,
                        action: "UPDATE",
                        previousData: createExpenseSnapshot(existingExpense),
                        newData: createExpenseSnapshot(expense),
                    },
                );

                return [expense];
            });

            logger.info("Expenses: Expense updated", { expenseId, staffId: context.staffId });
            const mapped = { ...updatedExpense, amount: Number(updatedExpense.amount) };
            return { success: true, data: mapped };
        } catch (error) {
            logger.error("Expenses: Error in updateExpense", { expenseId, error });
            return { success: false, error };
        }
    }

    static async deleteExpense(
        expenseId: number,
        context: AuditContext,
        logger: Logger,
    ): Promise<ExpenseDetailResponse> {
        try {
            const existingExpense = await prisma.expense.findUnique({
                where: { id: expenseId },
            });

            if (!existingExpense) {
                logger.warn("Expenses: Expense not found for delete", { expenseId });
                return { success: false, error: "Expense not found" };
            }

            if (existingExpense.deletedAt) {
                logger.warn("Expenses: Expense already deleted", { expenseId });
                return { success: false, error: "Expense already deleted" };
            }

            const [deletedExpense] = await prisma.$transaction(async (transaction) => {
                const expense = await transaction.expense.update({
                    where: { id: expenseId },
                    data: { deletedAt: new Date() },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "expense",
                        entityId: expenseId,
                        action: "DELETE",
                        previousData: createExpenseSnapshot(existingExpense),
                    },
                );

                return [expense];
            });

            logger.info("Expenses: Expense deleted", { expenseId, name: existingExpense.name, staffId: context.staffId });
            const mapped = { ...deletedExpense, amount: Number(deletedExpense.amount) };
            return { success: true, data: mapped };
        } catch (error) {
            logger.error("Expenses: Error in deleteExpense", { expenseId, error });
            return { success: false, error };
        }
    }

    static async restoreExpense(
        expenseId: number,
        context: AuditContext,
        logger: Logger,
    ): Promise<ExpenseDetailResponse> {
        try {
            const existingExpense = await prisma.expense.findUnique({
                where: { id: expenseId },
            });

            if (!existingExpense) {
                logger.warn("Expenses: Expense not found for restore", { expenseId });
                return { success: false, error: "Expense not found" };
            }

            if (!existingExpense.deletedAt) {
                logger.warn("Expenses: Expense is not deleted", { expenseId });
                return { success: false, error: "Expense is not deleted" };
            }

            const [restoredExpense] = await prisma.$transaction(async (transaction) => {
                const expense = await transaction.expense.update({
                    where: { id: expenseId },
                    data: { deletedAt: null },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "expense",
                        entityId: expenseId,
                        action: "RESTORE",
                        previousData: { deletedAt: existingExpense.deletedAt },
                        newData: createExpenseSnapshot(expense),
                    },
                );

                return [expense];
            });

            logger.info("Expenses: Expense restored", { expenseId, name: existingExpense.name, staffId: context.staffId });
            const mapped = { ...restoredExpense, amount: Number(restoredExpense.amount) };
            return { success: true, data: mapped };
        } catch (error) {
            logger.error("Expenses: Error in restoreExpense", { expenseId, error });
            return { success: false, error };
        }
    }
}
