import { useState, useMemo, useCallback, useEffect } from "react";
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
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsReady(true), 150);
        return () => clearTimeout(timer);
    }, []);

    const { data: expensesData, isLoading: isExpensesLoading } = useQuery(
        expensesListQueryOptions({ limit: 100, includeDeleted }),
    );

    const createExpense = useCreateExpense();
    const updateExpense = useUpdateExpense();
    const deleteExpense = useDeleteExpense();
    const restoreExpense = useRestoreExpense();

    const isLoading = isExpensesLoading || !isReady;

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
        async (
            data: Record<string, unknown>,
            _rowId: string,
            linkedId?: unknown,
        ) => {
            // If already linked, update any field
            if (linkedId) {
                const result = await updateExpense.mutateAsync({
                    id: linkedId as number,
                    name: data.name ? String(data.name) : undefined,
                    amount: data.amount ? Number(data.amount) : undefined,
                    description: data.description
                        ? String(data.description)
                        : undefined,
                    expenseDate: data.expenseDate
                        ? String(data.expenseDate)
                        : undefined,
                });
                return result?.id;
            }

            // For initial creation, name and amount are strictly required
            if (!data.name || !data.amount) {
                return; // Wait for essential data
            }

            const result = await createExpense.mutateAsync({
                name: String(data.name),
                amount: Number(data.amount),
                description: data.description ? String(data.description) : null,
                expenseDate: String(data.expenseDate) || dayjs().toISOString(),
            });
            return result?.id;
        },
        [createExpense, updateExpense],
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

    const multiRowDefaultValues = useMemo(() => ({
        expenseDate: dayjs().toISOString()
    }), []);

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
                    multiRowDefaultValues={multiRowDefaultValues}
                    translations={translations}
                />
            )}
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/expense")({
    component: ExpensePage,
});
