import { useState, useMemo, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { PageTransition, DataTable, DataTableSkeleton, Checkbox } from "@jahonbozor/ui";
import type { DataTableTranslations } from "@jahonbozor/ui";
import { expensesListQueryOptions, useCreateExpense, useUpdateExpense, useDeleteExpense, useRestoreExpense } from "@/api/expenses.api";
import { getExpenseColumns } from "@/components/expenses/expenses-columns";

function ExpensePage() {
    const { t } = useTranslation("expenses");
    const [includeDeleted, setIncludeDeleted] = useState(false);

    const { data: expensesData, isLoading } = useQuery(
        expensesListQueryOptions({ limit: 100, includeDeleted }),
    );

    const createExpense = useCreateExpense();
    const updateExpense = useUpdateExpense();
    const deleteExpense = useDeleteExpense();
    const restoreExpense = useRestoreExpense();

    const actions = useMemo(() => ({
        onDelete: (id: number) => deleteExpense.mutate(id),
        onRestore: (id: number) => restoreExpense.mutate(id),
    }), [deleteExpense, restoreExpense]);

    const columns = useMemo(
        () => getExpenseColumns(t, actions),
        [t, actions],
    );

    const expenses = expensesData?.expenses ?? [];

    const handleCellEdit = useCallback(
        async (rowIndex: number, columnId: string, value: unknown) => {
            const expense = expenses[rowIndex];
            if (!expense) return;

            const body: Record<string, unknown> = {};
            body[columnId] = value;

            updateExpense.mutate({ id: expense.id, ...body });
        },
        [expenses, updateExpense],
    );

    const handleNewRowSave = useCallback(
        async (data: Record<string, unknown>) => {
            createExpense.mutate({
                name: String(data.name),
                amount: Number(data.amount),
                description: data.description ? String(data.description) : null,
                expenseDate: String(data.expenseDate) || dayjs().toISOString(),
            });
        },
        [createExpense],
    );

    const translations: DataTableTranslations = {
        search: t("common:search"),
        noResults: t("expenses_empty"),
        columns: t("table_columns"),
        rowsPerPage: t("common:per_page"),
        showAll: t("table_show_all"),
        previous: t("table_previous"),
        next: t("table_next"),
        filterAll: t("common:filter_all"),
        filterMin: t("common:filter_min"),
        filterMax: t("common:filter_max"),
        filter: t("common:filter"),
    };

    return (
        <PageTransition className="p-6 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">{t("title")}</h1>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                        checked={includeDeleted}
                        onCheckedChange={(checked) => setIncludeDeleted(checked === true)}
                    />
                    {t("common:show_deleted")}
                </label>
            </div>

            {isLoading ? (
                <DataTableSkeleton columns={9} rows={10} className="flex-1" />
            ) : (
                <DataTable
                    className="flex-1"
                    columns={columns}
                    data={expenses}
                    pagination
                    defaultPageSize={20}
                    pageSizeOptions={[10, 20, 50]}
                    enableShowAll
                    enableSorting
                    enableGlobalSearch
                    enableFiltering
                    enableColumnVisibility
                    enableColumnResizing
                    enableEditing
                    enableMultipleNewRows
                    multiRowCount={15}
                    onCellEdit={handleCellEdit}
                    onMultiRowSave={handleNewRowSave}
                    multiRowDefaultValues={{ expenseDate: dayjs().toISOString() } as any}
                    translations={translations}
                />
            )}
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/expense")({
    component: ExpensePage,
});
