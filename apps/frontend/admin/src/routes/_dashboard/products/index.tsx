import {
    categoriesListQueryOptions,
    useCreateCategory,
} from "@/api/categories.api";
import {
    productsListQueryOptions,
    useCreateProduct,
    useDeleteProduct,
    useRestoreProduct,
    useUpdateProduct,
} from "@/api/products.api";
import { getProductColumns } from "@/components/products/products-columns";
import type { DataTableTranslations } from "@jahonbozor/ui";
import {
    Checkbox,
    DataTable,
    DataTableSkeleton,
    PageTransition,
} from "@jahonbozor/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

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
    const deleteProduct = useDeleteProduct();
    const restoreProduct = useRestoreProduct();
    const createCategory = useCreateCategory();

    const resolveCategoryId = useCallback(
        async (value: unknown): Promise<number> => {
            const num = Number(value);
            if (!isNaN(num) && num > 0) return num;
            // Free-form text — create a new category
            const newCategory = await createCategory.mutateAsync({
                name: String(value),
            });
            return newCategory.id;
        },
        [createCategory],
    );

    const categories = useMemo(() => {
        if (!categoriesData?.categories) return [];
        return categoriesData.categories.map((c) => ({
            id: c.id,
            name: c.name,
        }));
    }, [categoriesData]);

    const actions = useMemo(
        () => ({
            onDelete: (id: number) => deleteProduct.mutate(id),
            onRestore: (id: number) => restoreProduct.mutate(id),
        }),
        [deleteProduct, restoreProduct],
    );

    const columns = useMemo(
        () => getProductColumns(t, categories, actions),
        [t, categories, actions],
    );

    const products = productsData?.products ?? [];

    const handleCellEdit = useCallback(
        async (rowIndex: number, columnId: string, value: unknown) => {
            const product = products[rowIndex];
            if (!product) return;

            const body: Record<string, unknown> = {};
            if (columnId === "category") {
                body.categoryId = await resolveCategoryId(value);
            } else {
                body[columnId] = value;
            }

            updateProduct.mutate({ id: product.id, ...body });
        },
        [products, updateProduct, resolveCategoryId],
    );

    const handleNewRowSave = useCallback(
        async (data: Record<string, unknown>) => {
            const categoryId = await resolveCategoryId(data.category);
            createProduct.mutate({
                name: String(data.name),
                price: Number(data.price),
                costprice: Number(data.costprice),
                categoryId,
                remaining: Number(data.remaining) || 0,
            });
        },
        [createProduct, resolveCategoryId],
    );

    const translations: DataTableTranslations = {
        search: t("common:search"),
        noResults: t("products_empty"),
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
                <h1 className="text-2xl font-bold">{t("common:products")}</h1>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                        checked={includeDeleted}
                        onCheckedChange={(checked) =>
                            setIncludeDeleted(checked === true)
                        }
                    />
                    {t("common:show_deleted")}
                </label>
            </div>

            {isLoading ? (
                <DataTableSkeleton columns={9} rows={10} className="flex-1" />
            ) : (
                <DataTable
                    className="flex-1 costprice-table"
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
