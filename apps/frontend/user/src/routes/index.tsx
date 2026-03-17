import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
    AnimatedList,
    AnimatedListItem,
    AnimatePresence,
    motion,
    PageTransition,
    Skeleton,
} from "@jahonbozor/ui";

import { categoriesListOptions } from "@/api/categories.api";
import { productsListOptions } from "@/api/products.api";
import { CategorySection } from "@/components/catalog/category-section";
import { ProductCard } from "@/components/catalog/product-card";
import { SearchBar } from "@/components/catalog/search-bar";

function HomePage() {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState("");

    const { data: categoriesData, isLoading: categoriesLoading } =
        useQuery(categoriesListOptions());
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
        <PageTransition>
            <div className="bg-background sticky top-14 z-40">
                <SearchBar value={searchQuery} onChange={handleSearch} />
            </div>

            <AnimatePresence mode="wait">
                {isSearching && searchLoading && (
                    <motion.div
                        key="search-loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col gap-3 px-4"
                    >
                        <Skeleton className="h-24 w-full rounded-xl" />
                        <Skeleton className="h-24 w-full rounded-xl" />
                        <Skeleton className="h-24 w-full rounded-xl" />
                    </motion.div>
                )}

                {isSearching && !searchLoading && (searchData?.products?.length ?? 0) === 0 && (
                    <motion.p
                        key="search-empty"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-muted-foreground px-4 py-8 text-center"
                    >
                        {t("no_data")}
                    </motion.p>
                )}

                {isSearching && !searchLoading && (searchData?.products?.length ?? 0) > 0 && (
                    <AnimatedList key="search-results" className="flex flex-col gap-1.5 px-4 py-2">
                        {searchData?.products?.map((product) => (
                            <AnimatedListItem key={product.id}>
                                <ProductCard
                                    productId={product.id}
                                    name={product.name}
                                    price={product.price}
                                    remaining={product.remaining}
                                />
                            </AnimatedListItem>
                        ))}
                    </AnimatedList>
                )}

                {!isSearching && categoriesLoading && (
                    <motion.div
                        key="categories-loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col gap-3 px-4"
                    >
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-24 w-full rounded-xl" />
                        <Skeleton className="h-24 w-full rounded-xl" />
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-24 w-full rounded-xl" />
                        <Skeleton className="h-24 w-full rounded-xl" />
                    </motion.div>
                )}

                {!isSearching && !categoriesLoading && (
                    <AnimatedList key="categories" className="flex flex-col gap-6 px-4 py-2">
                        {categories.map((category) => (
                            <AnimatedListItem key={category.id}>
                                <CategorySection
                                    categoryId={category.id}
                                    categoryName={category.name}
                                />
                            </AnimatedListItem>
                        ))}
                    </AnimatedList>
                )}
            </AnimatePresence>
        </PageTransition>
    );
}

export const Route = createFileRoute("/")({
    loader: ({ context }) => {
        void context.queryClient.ensureQueryData(categoriesListOptions());
    },
    component: HomePage,
});
