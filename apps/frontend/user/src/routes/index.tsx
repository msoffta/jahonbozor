import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState, useCallback } from "react";
import { SearchBar } from "@/components/catalog/search-bar";
import { CategorySection } from "@/components/catalog/category-section";
import { ProductCard } from "@/components/catalog/product-card";
import { productsListOptions } from "@/api/products.api";
import { categoriesListOptions } from "@/api/categories.api";
import { Skeleton } from "@jahonbozor/ui";

function HomePage() {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState("");

    const { data: categoriesData, isLoading: categoriesLoading } = useQuery(
        categoriesListOptions(),
    );
    const { data: searchData, isLoading: searchLoading } = useQuery({
        ...productsListOptions({ limit: 20, searchQuery }),
        enabled: searchQuery.length > 0,
    });

    const handleSearch = useCallback((query: string) => {
        setSearchQuery(query);
    }, []);

    const categories = categoriesData?.categories ?? [];
    const isSearching = searchQuery.length > 0;

    return (
        <div>
            <div className="sticky top-14 z-40 bg-background">
                <SearchBar value={searchQuery} onChange={handleSearch} />
            </div>

            {isSearching && searchLoading && (
                <div className="flex flex-col gap-3 px-4">
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                </div>
            )}

            {isSearching && !searchLoading && (searchData?.products?.length ?? 0) === 0 && (
                <p className="px-4 py-8 text-center text-muted-foreground">
                    {t("no_data")}
                </p>
            )}

            {isSearching && !searchLoading && (searchData?.products?.length ?? 0) > 0 && (
                <div className="flex flex-col gap-1.5 px-4 py-2">
                    {searchData?.products?.map((product) => (
                        <ProductCard
                            key={product.id}
                            id={product.id}
                            name={product.name}
                            price={product.price}
                            remaining={product.remaining}
                        />
                    ))}
                </div>
            )}

            {!isSearching && categoriesLoading && (
                <div className="flex flex-col gap-3 px-4">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                </div>
            )}

            {!isSearching && !categoriesLoading && (
                <div className="flex flex-col gap-6 px-4 py-2">
                    {categories.map((category) => (
                        <CategorySection
                            key={category.id}
                            categoryId={category.id}
                            categoryName={category.name}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export const Route = createFileRoute("/")({
    component: HomePage,
});
