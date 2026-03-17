import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { Permission, hasPermission } from "@jahonbozor/schemas";
import { AnimatePresence, DataTable, DataTableSkeleton, motion, PageTransition } from "@jahonbozor/ui";
import { incomeListQueryOptions, useCreateIncome } from "@/api/income.api";
import { productsListQueryOptions } from "@/api/products.api";
import { getIncomeColumns } from "@/components/income/income-columns";
import { useAuthStore } from "@/stores/auth.store";
import { useHasPermission } from "@/hooks/use-permissions";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { useDeferredReady } from "@/hooks/use-deferred-ready";

function IncomePage() {
    const { t } = useTranslation("income");
    const isReady = useDeferredReady();
    const translations = useDataTableTranslations("income_empty");

    // Permission check for creating income records
    const canCreate = useHasPermission(Permission.PRODUCT_HISTORY_CREATE);

    const { data: incomeData, isLoading: isIncomeLoading } = useQuery(
        incomeListQueryOptions({ limit: 100 }),
    );

    const { data: productsData, isLoading: isProductsLoading } = useQuery(
        productsListQueryOptions({ limit: 100, includeDeleted: false }),
    );

    const createIncome = useCreateIncome();

    const products = productsData?.products ?? [];

    const columns = useMemo(() => getIncomeColumns(t, products), [t, products]);

    const history = incomeData?.history ?? [];

    const handleNewRowSave = useCallback(
        async (data: Record<string, unknown>, _rowId: string) => {
            // Product and quantity are strictly required
            const productId = Number(data.product);
            const quantity = Number(data.quantity);

            if (!productId || isNaN(productId) || !quantity || isNaN(quantity)) {
                return; // Wait for essential valid data
            }

            try {
                const result = await createIncome.mutateAsync({
                    productId,
                    quantity,
                    changeReason: data.changeReason
                        ? String(data.changeReason).trim() || null
                        : null,
                    createdAt: data.createdAt
                        ? String(data.createdAt)
                        : dayjs().toISOString(),
                });
                
                // The API returns { product, historyEntry }
                return result.historyEntry.id;
            } catch {
                return;
            }
        },
        [createIncome],
    );

    const isLoading = isIncomeLoading || isProductsLoading || !isReady;

    const multiRowDefaultValues = useMemo(() => ({
        createdAt: dayjs().toISOString()
    }), []);

    return (
        <PageTransition className="p-6 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">{t("title")}</h1>
            </div>

            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <DataTableSkeleton columns={6} rows={10} className="flex-1" />
                    </motion.div>
                ) : (
                    <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-0">
                        <DataTable
                            className="flex-1"
                            columns={columns}
                            data={history}
                            pagination
                            defaultPageSize={20}
                            pageSizeOptions={[10, 20, 50]}
                            enableShowAll
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
