import { useState, useMemo, useCallback } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { Permission, hasPermission } from "@jahonbozor/schemas";
import { AnimatePresence, PageTransition, DataTable, DataTableSkeleton, Checkbox, motion } from "@jahonbozor/ui";
import { expensesListQueryOptions, useCreateExpense, useUpdateExpense, useDeleteExpense, useRestoreExpense } from "@/api/expenses.api";
import { getExpenseColumns } from "@/components/expenses/expenses-columns";
import { useAuthStore } from "@/stores/auth.store";
import { useHasPermission } from "@/hooks/use-permissions";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { useDeferredReady } from "@/hooks/use-deferred-ready";

function ExpensePage() {
    const { t } = useTranslation("expenses");
    const [includeDeleted, setIncludeDeleted] = useState(false);
    const isReady = useDeferredReady();
    const translations = useDataTableTranslations("expenses_empty");

    // Permission checks for expense actions
    const canCreate = useHasPermission(Permission.EXPENSES_CREATE);
    const canUpdate = useHasPermission(Permission.EXPENSES_UPDATE);
    const canDelete = useHasPermission(Permission.EXPENSES_DELETE);

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
        () => getExpenseColumns(t, actions, { canDelete }),
        [t, actions, canDelete],
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

            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <DataTableSkeleton columns={9} rows={10} className="flex-1" />
                    </motion.div>
                ) : (
                    <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-0">
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
                            enableEditing={canUpdate}
                            enableMultipleNewRows={canCreate}
                            multiRowCount={15}
                            onCellEdit={handleCellEdit}
                            onMultiRowSave={handleNewRowSave}
                            multiRowDefaultValues={multiRowDefaultValues}
                            translations={translations}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/expense")({
    beforeLoad: async () => {
        const { permissions } = useAuthStore.getState();
        if (!hasPermission(permissions, Permission.EXPENSES_LIST)) {
            throw redirect({ to: "/" });
        }
    },
    component: ExpensePage,
});
