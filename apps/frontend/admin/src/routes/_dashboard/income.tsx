import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { endOfDay, endOfMonth, startOfDay, startOfMonth } from "date-fns";

import { hasPermission, Permission } from "@jahonbozor/schemas";
import {
    AnimatePresence,
    Button,
    DataTable,
    DataTableSkeleton,
    DatePicker,
    motion,
    PageTransition,
    useIsMobile,
} from "@jahonbozor/ui";

import { incomeListQueryOptions, useCreateIncome } from "@/api/income.api";
import { productsListQueryOptions } from "@/api/products.api";
import { getIncomeColumns } from "@/components/income/income-columns";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { useDeferredReady } from "@/hooks/use-deferred-ready";
import { useHasPermission } from "@/hooks/use-permissions";
import { useAuthStore } from "@/stores/auth.store";

function IncomePage() {
    const { t } = useTranslation("income");
    const isReady = useDeferredReady();
    const translations = useDataTableTranslations(t("income_empty"));

    const monthStart = startOfMonth(new Date()).toISOString();
    const monthEnd = endOfMonth(new Date()).toISOString();
    const [dateFrom, setDateFrom] = useState(monthStart);
    const [dateTo, setDateTo] = useState(monthEnd);
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

    // Permission check for creating income records
    const canCreate = useHasPermission(Permission.PRODUCT_HISTORY_CREATE);

    const { data: incomeData, isLoading: isIncomeLoading } = useQuery(
        incomeListQueryOptions({
            page: pagination.pageIndex + 1,
            limit: pagination.pageSize,
            dateFrom,
            dateTo,
        }),
    );

    const { data: productsData, isLoading: isProductsLoading } = useQuery(
        productsListQueryOptions({ limit: 100, includeDeleted: false }),
    );

    const createIncome = useCreateIncome();

    const products = productsData?.products ?? [];

    const columns = useMemo(() => getIncomeColumns(t, products), [t, products]);

    const history = incomeData?.history ?? [];

    const isMobile = useIsMobile();
    const initialColumnVisibility = useMemo(
        (): Record<string, boolean> => (isMobile ? { changeReason: false, staff: false } : {}),
        [isMobile],
    );

    const handleNewRowSave = useCallback(
        async (data: Record<string, unknown>, _rowId: string) => {
            // Product and quantity are strictly required
            const productId = Number(data.product);
            const quantity = Number(data.quantity);

            if (!productId || isNaN(productId) || !quantity || isNaN(quantity)) {
                return; // Wait for essential valid data
            }

            try {
                const result = (await createIncome.mutateAsync({
                    productId,
                    quantity,
                    changeReason:
                        data.changeReason != null
                            ? String(data.changeReason as string).trim() || null
                            : null,
                    createdAt:
                        data.createdAt != null
                            ? String(data.createdAt as string)
                            : new Date().toISOString(),
                })) as { product: unknown; historyEntry: { id: number } };

                return result.historyEntry.id;
            } catch {
                return;
            }
        },
        [createIncome],
    );

    const isLoading = isIncomeLoading || isProductsLoading || !isReady;

    const multiRowDefaultValues = useMemo(
        () => ({
            createdAt: new Date().toISOString(),
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
                        <DataTableSkeleton columns={6} rows={10} className="flex-1" />
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
                            data={history}
                            pagination
                            manualPagination
                            pageCount={Math.ceil((incomeData?.count ?? 0) / pagination.pageSize)}
                            onPaginationChange={setPagination}
                            defaultPageSize={20}
                            pageSizeOptions={[10, 20, 50]}
                            enableSorting
                            enableGlobalSearch
                            enableFiltering
                            enableColumnVisibility
                            enableColumnResizing
                            enableEditing={false}
                            enableMultipleNewRows={canCreate}
                            multiRowCount={15}
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

export const Route = createFileRoute("/_dashboard/income")({
    beforeLoad: async () => {
        const { permissions } = useAuthStore.getState();
        if (!hasPermission(permissions, Permission.PRODUCT_HISTORY_LIST)) {
            throw redirect({ to: "/" });
        }
    },
    component: IncomePage,
});
