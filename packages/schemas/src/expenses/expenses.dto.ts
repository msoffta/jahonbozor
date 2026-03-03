import z from "zod";
import { PaginationQuery } from "../common/pagination.model";
import { Expense } from "./expenses.model";

export const CreateExpenseBody = Expense.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    staffId: true,
});

export const UpdateExpenseBody = CreateExpenseBody.partial();

export const ExpensesPagination = PaginationQuery.extend({
    staffId: z.coerce.number().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    includeDeleted: z.coerce.boolean().optional().default(false),
});

export type CreateExpenseBody = z.infer<typeof CreateExpenseBody>;
export type UpdateExpenseBody = z.infer<typeof UpdateExpenseBody>;
export type ExpensesPagination = z.infer<typeof ExpensesPagination>;

// --- Response types ---

import type { ReturnSchema } from "../common/base.model";

export interface ExpenseItem {
    id: number;
    name: string;
    amount: number;
    description: string | null;
    expenseDate: Date | string;
    staffId: number;
    deletedAt: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    staff?: { id: number; fullname: string };
}

export type ExpensesListResponse = ReturnSchema<{
    count: number;
    expenses: ExpenseItem[];
}>;
export type ExpenseDetailResponse = ReturnSchema<ExpenseItem>;
