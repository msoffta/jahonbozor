import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { hasPermission, Permission } from "@jahonbozor/schemas";
import {
    AnimatePresence,
    DataTable,
    DataTableSkeleton,
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
            <div className="mb-4 flex items-center justify-between md:mb-6">
                <h1 className="text-xl font-bold md:text-2xl">{t("title")}</h1>
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
