import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { hasPermission, Permission } from "@jahonbozor/schemas";
import {
    AnimatePresence,
    Checkbox,
    DataTable,
    DataTableSkeleton,
    motion,
    PageTransition,
    useIsMobile,
} from "@jahonbozor/ui";

import { categoriesListQueryOptions, useCreateCategory } from "@/api/categories.api";
import {
    productsListQueryOptions,
    useCreateProduct,
    useDeleteProduct,
    useRestoreProduct,
    useUpdateProduct,
} from "@/api/products.api";
import { getProductColumns } from "@/components/products/products-columns";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { useDeferredReady } from "@/hooks/use-deferred-ready";
import { useHasPermission } from "@/hooks/use-permissions";
import { useAuthStore } from "@/stores/auth.store";

function ProductsPage() {
    const { t } = useTranslation("products");
    const [includeDeleted, setIncludeDeleted] = useState(false);
    const isReady = useDeferredReady();
    const translations = useDataTableTranslations("products_empty");

    // Permission checks for component-level actions
    const canCreate = useHasPermission(Permission.PRODUCTS_CREATE);
    const canUpdate = useHasPermission(Permission.PRODUCTS_UPDATE);
    const canDelete = useHasPermission(Permission.PRODUCTS_DELETE);

    const { data: productsData, isLoading: isProductsLoading } = useQuery(
        productsListQueryOptions({ limit: 100, includeDeleted }),
    );

    const { data: categoriesData } = useQuery(categoriesListQueryOptions({ limit: 100 }));

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
        () => getProductColumns(t, categories, actions, { canDelete }),
        [t, categories, actions, canDelete],
    );

    const products = productsData?.products ?? [];

    const isMobile = useIsMobile();
    const initialColumnVisibility = useMemo(
        (): Record<string, boolean> =>
            isMobile ? { costprice: false, category: false, status: false, createdAt: false } : {},
        [isMobile],
    );

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
        async (data: Record<string, unknown>, _rowId: string, linkedId?: unknown) => {
            // If already created, we can update any field individually
            if (linkedId) {
                const body: Record<string, unknown> = {};
                if (data.name != null) body.name = String(data.name as string);
                if (data.price !== undefined) body.price = Number(data.price);
                if (data.costprice !== undefined) body.costprice = Number(data.costprice);
                if (data.remaining !== undefined) body.remaining = Number(data.remaining);
                if (data.category) body.categoryId = await resolveCategoryId(data.category);

                const result = await updateProduct.mutateAsync({
                    id: linkedId as number,
                    ...body,
                });
                return result?.id;
            }

            // For initial creation, check if all required fields are present
            if (!data.name || data.price === undefined || !data.category) {
                return; // Wait for more data before creating
            }

            const categoryId = await resolveCategoryId(data.category);
            const result = await createProduct.mutateAsync({
                name: String(data.name as string),
                price: Number(data.price),
                costprice: Number(data.costprice) || 0,
                categoryId,
                remaining: Number(data.remaining) || 0,
            });
            return result?.id;
        },
        [createProduct, updateProduct, resolveCategoryId],
    );

    const isLoading = isProductsLoading || !isReady;

    return (
        <PageTransition className="flex min-h-0 flex-1 flex-col p-3 md:p-6">
            <div className="mb-4 flex items-center justify-between md:mb-6">
                <h1 className="text-xl font-bold md:text-2xl">{t("common:products")}</h1>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                        checked={includeDeleted}
                        onCheckedChange={(checked) => setIncludeDeleted(checked === true)}
                    />
                    {t("common:show_deleted")}
                </label>
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
                            className="costprice-table flex-1"
                            columns={columns}
                            initialColumnVisibility={initialColumnVisibility}
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
                            enableEditing={canUpdate}
                            enableMultipleNewRows={canCreate}
                            multiRowCount={15}
                            onCellEdit={handleCellEdit}
                            onMultiRowSave={handleNewRowSave}
                            translations={translations}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/products/")({
    beforeLoad: async () => {
        const { permissions } = useAuthStore.getState();
        if (!hasPermission(permissions, Permission.PRODUCTS_LIST)) {
            throw redirect({ to: "/" });
        }
    },
    component: ProductsPage,
});
