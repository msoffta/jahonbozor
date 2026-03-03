import { useState, useMemo, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PageTransition, DataTable, Checkbox } from "@jahonbozor/ui";
import type { DataTableTranslations } from "@jahonbozor/ui";
import { productsListQueryOptions, useCreateProduct, useUpdateProduct } from "@/api/products.api";
import { categoriesListQueryOptions } from "@/api/categories.api";
import { getProductColumns } from "@/components/products/products-columns";

function ProductsPage() {
    const { t } = useTranslation("products");
    const [includeDeleted, setIncludeDeleted] = useState(false);

    const { data: productsData, isLoading } = useQuery(
        productsListQueryOptions({ limit: 100, includeDeleted }),
    );

    const { data: categoriesData } = useQuery(
        categoriesListQueryOptions({ limit: 100 }),
    );

    const createProduct = useCreateProduct();
    const updateProduct = useUpdateProduct();

    const categories = useMemo(() => {
        if (!categoriesData?.categories) return [];
        return categoriesData.categories.map((c) => ({
            id: c.id,
            name: c.name,
        }));
    }, [categoriesData]);

    const columns = useMemo(
        () => getProductColumns(t, categories),
        [t, categories],
    );

    const products = productsData?.products ?? [];

    const handleCellEdit = useCallback(
        (rowIndex: number, columnId: string, value: unknown) => {
            const product = products[rowIndex];
            if (!product) return;

            const body: Record<string, unknown> = {};
            if (columnId === "category") {
                body.categoryId = Number(value);
            } else {
                body[columnId] = value;
            }

            updateProduct.mutate({ id: product.id, ...body });
        },
        [products, updateProduct],
    );

    const handleNewRowSave = useCallback(
        (data: Record<string, unknown>) => {
            createProduct.mutate({
                name: String(data.name),
                price: Number(data.price),
                costprice: Number(data.costprice),
                categoryId: Number(data.category),
                remaining: Number(data.remaining) || 0,
            });
        },
        [createProduct],
    );

    const translations: DataTableTranslations = {
        search: t("common:search"),
        noResults: t("products_empty"),
        columns: t("table_columns"),
        rowsPerPage: t("common:per_page"),
        showAll: t("table_show_all"),
        previous: t("table_previous"),
        next: t("table_next"),
    };

    return (
        <PageTransition className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">{t("common:products")}</h1>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                        checked={includeDeleted}
                        onCheckedChange={(checked) => setIncludeDeleted(checked === true)}
                    />
                    {t("common:show_deleted")}
                </label>
            </div>

            {isLoading ? (
                <div className="text-muted-foreground">{t("common:loading")}</div>
            ) : (
                <DataTable
                    columns={columns}
                    data={products}
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
                    enableNewRow
                    onCellEdit={handleCellEdit}
                    onNewRowSave={handleNewRowSave}
                    translations={translations}
                />
            )}
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/products/")({
    component: ProductsPage,
});
