import { incomeListQueryOptions, useCreateIncome, useUpdateIncome } from "@/api/income.api";
import { productsListQueryOptions } from "@/api/products.api";
import { getIncomeColumns } from "@/components/income/income-columns";
import type { DataTableTranslations } from "@jahonbozor/ui";
import { DataTable, DataTableSkeleton, PageTransition } from "@jahonbozor/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

function IncomePage() {
    const { t } = useTranslation("income");

    const { data: incomeData, isLoading: isIncomeLoading } = useQuery(
        incomeListQueryOptions({ limit: 100 }),
    );

    const { data: productsData, isLoading: isProductsLoading } = useQuery(
        productsListQueryOptions({ limit: 100, includeDeleted: false }),
    );

    const createIncome = useCreateIncome();
    const updateIncome = useUpdateIncome();

    const products = productsData?.products ?? [];

    const columns = useMemo(() => getIncomeColumns(t, products), [t, products]);

    const history = incomeData?.history ?? [];

    const handleNewRowSave = useCallback(
        async (
            data: Record<string, unknown>,
            _rowId: string,
            linkedId?: unknown,
        ) => {
            // If already linked, update any field
            if (linkedId) {
                const result = await updateIncome.mutateAsync({
                    id: linkedId as number,
                    productId: data.product ? Number(data.product) : undefined,
                    quantity: data.quantity ? Number(data.quantity) : undefined,
                    changeReason: data.changeReason
                        ? String(data.changeReason)
                        : undefined,
                    createdAt: data.createdAt ? String(data.createdAt) : undefined,
                });
                return result.data?.id;
            }

            // For initial creation, product and quantity are strictly required
            if (!data.product || !data.quantity) {
                return; // Wait for essential data
            }

            const result = await createIncome.mutateAsync({
                productId: Number(data.product),
                quantity: Number(data.quantity),
                changeReason: data.changeReason ? String(data.changeReason) : null,
                createdAt: data.createdAt
                    ? String(data.createdAt)
                    : dayjs().toISOString(),
            });
            return result.data?.id;
        },
        [createIncome, updateIncome],
    );

    const translations: DataTableTranslations = {
        search: t("common:search"),
        noResults: t("income_empty"),
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

    const isLoading = isIncomeLoading || isProductsLoading;

    return (
        <PageTransition className="p-6 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">{t("title")}</h1>
            </div>

            {isLoading ? (
                <DataTableSkeleton columns={6} rows={10} className="flex-1" />
            ) : (
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
                    enableMultipleNewRows
                    multiRowCount={15}
                    onMultiRowSave={handleNewRowSave}
                    multiRowDefaultValues={
                        { createdAt: dayjs().toISOString() } as any
                    }
                    translations={translations}
                />
            )}
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/income")({
    component: IncomePage,
});
