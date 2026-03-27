import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { endOfDay, endOfMonth, startOfDay, startOfMonth } from "date-fns";

import { hasPermission, Permission } from "@jahonbozor/schemas";
import {
    AnimatePresence,
    Button,
    Checkbox,
    DataTable,
    DataTableSkeleton,
    DatePicker,
    motion,
    PageTransition,
    useIsMobile,
} from "@jahonbozor/ui";

import {
    expensesInfiniteQueryOptions,
    useCreateExpense,
    useDeleteExpense,
    useRestoreExpense,
    useUpdateExpense,
} from "@/api/expenses.api";
import { getExpenseColumns } from "@/components/expenses/expenses-columns";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { useDeferredReady } from "@/hooks/use-deferred-ready";
import { useHasPermission } from "@/hooks/use-permissions";
import { useAuthStore } from "@/stores/auth.store";

function ExpensePage() {
    const { t } = useTranslation("expenses");
    const [includeDeleted, setIncludeDeleted] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const isReady = useDeferredReady();
    const translations = useDataTableTranslations(t("expenses_empty"));

    const monthStart = startOfMonth(new Date()).toISOString();
    const monthEnd = endOfMonth(new Date()).toISOString();
    const [dateFrom, setDateFrom] = useState(monthStart);
    const [dateTo, setDateTo] = useState(monthEnd);

    // Permission checks for expense actions
    const canCreate = useHasPermission(Permission.EXPENSES_CREATE);
    const canUpdate = useHasPermission(Permission.EXPENSES_UPDATE);
    const canDelete = useHasPermission(Permission.EXPENSES_DELETE);

    const {
        data: expensesData,
        isLoading: isExpensesLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery(
        expensesInfiniteQueryOptions({
            includeDeleted,
            searchQuery,
            dateFrom,
            dateTo,
        }),
    );

    const createExpense = useCreateExpense();
    const updateExpense = useUpdateExpense();
    const deleteExpense = useDeleteExpense();
    const restoreExpense = useRestoreExpense();

    const loadingRowIds = useMemo(() => {
        const ids = new Set<number>();
        if (updateExpense.isPending && updateExpense.variables?.id)
            ids.add(updateExpense.variables.id);
        if (deleteExpense.isPending && deleteExpense.variables) ids.add(deleteExpense.variables);
        if (restoreExpense.isPending && restoreExpense.variables) ids.add(restoreExpense.variables);
        return ids;
    }, [
        updateExpense.isPending,
        updateExpense.variables,
        deleteExpense.isPending,
        deleteExpense.variables,
        restoreExpense.isPending,
        restoreExpense.variables,
    ]);

    const isLoading = isExpensesLoading || !isReady;

    const actions = useMemo(
        () => ({
            onDelete: (id: number) => deleteExpense.mutate(id),
            onRestore: (id: number) => restoreExpense.mutate(id),
        }),
        [deleteExpense, restoreExpense],
    );

    const columns = useMemo(
        () => getExpenseColumns(t, actions, { canDelete }),
        [t, actions, canDelete],
    );

    const expenses = useMemo(() => {
        const all = expensesData?.pages.flatMap((p) => p.expenses) ?? [];
        if (includeDeleted) return all.filter((e) => e.deletedAt != null);
        return all;
    }, [expensesData, includeDeleted]);
    const totalCount = expensesData?.pages[0]?.count ?? 0;

    const isMobile = useIsMobile();
    const initialColumnVisibility = useMemo(
        (): Record<string, boolean> =>
            isMobile
                ? {
                      description: false,
                      expenseDate: false,
                      staff: false,
                      status: false,
                      createdAt: false,
                  }
                : {},
        [isMobile],
    );

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
        async (data: Record<string, unknown>, _rowId: string, linkedId?: unknown) => {
            // If already linked, update any field
            if (linkedId) {
                const result = await updateExpense.mutateAsync({
                    id: linkedId as number,
                    name: data.name != null ? String(data.name as string) : undefined,
                    amount: data.amount ? Number(data.amount) : undefined,
                    description:
                        data.description != null ? String(data.description as string) : undefined,
                    expenseDate:
                        data.expenseDate != null ? String(data.expenseDate as string) : undefined,
                });
                return result?.id;
            }

            // For initial creation, name and amount are strictly required
            if (!data.name || !data.amount) {
                return; // Wait for essential data
            }

            const result = await createExpense.mutateAsync({
                name: String(data.name as string),
                amount: Number(data.amount),
                description: data.description != null ? String(data.description as string) : null,
                expenseDate:
                    data.expenseDate != null
                        ? String(data.expenseDate as string)
                        : new Date().toISOString(),
            });
            return result?.id;
        },
        [createExpense, updateExpense],
    );

    const multiRowDefaultValues = useMemo(
        () => ({
            expenseDate: new Date().toISOString(),
        }),
        [],
    );

    return (
        <PageTransition className="flex min-h-0 flex-1 flex-col p-3 md:p-6">
            <div className="mb-2 flex flex-col gap-3 md:mb-4 md:flex-row md:items-center md:justify-between">
                <h1 className="text-xl font-bold md:text-2xl">{t("title")}</h1>
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                    <div className="flex items-center gap-2">
                        <DatePicker
                            value={dateFrom}
                            onChange={(date) => {
                                if (date) setDateFrom(startOfDay(new Date(date)).toISOString());
                            }}
                            className="h-8 w-28 text-xs sm:w-36"
                        />
                        <span className="text-muted-foreground text-xs">—</span>
                        <DatePicker
                            value={dateTo}
                            onChange={(date) => {
                                if (date) setDateTo(endOfDay(new Date(date)).toISOString());
                            }}
                            className="h-8 w-28 text-xs sm:w-36"
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setDateFrom(monthStart);
                            setDateTo(monthEnd);
                        }}
                    >
                        {t("common:this_month")}
                    </Button>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                            checked={includeDeleted}
                            onCheckedChange={(checked) => setIncludeDeleted(checked === true)}
                        />
                        {t("common:show_deleted")}
                    </label>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div
                        key="skeleton"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <DataTableSkeleton columns={9} rows={10} className="flex-1" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="table"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <DataTable
                            className="flex-1"
                            columns={columns}
                            initialColumnVisibility={initialColumnVisibility}
                            data={expenses}
                            enableInfiniteScroll
                            onFetchNextPage={fetchNextPage}
                            hasNextPage={hasNextPage}
                            isFetchingNextPage={isFetchingNextPage}
                            totalCount={totalCount}
                            enableSorting
                            enableGlobalSearch
                            onSearchQueryChange={setSearchQuery}
                            enableFiltering
                            enableColumnVisibility
                            enableColumnResizing
                            enableEditing={canUpdate}
                            enableMultipleNewRows={canCreate}
                            multiRowCount={50}
                            multiRowMaxCount={50}
                            onCellEdit={handleCellEdit}
                            onMultiRowSave={handleNewRowSave}
                            multiRowDefaultValues={multiRowDefaultValues}
                            loadingRowIds={loadingRowIds}
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
