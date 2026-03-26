import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

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

const HOME_PRODUCTS_LIMIT = 10;

function HomePage() {
    const { t } = useTranslation();
    const { t: tCatalog } = useTranslation("catalog");
    const [searchQuery, setSearchQuery] = useState("");

    const { data: categoriesData, isLoading: categoriesLoading } =
        useQuery(categoriesListOptions());
    const { data: allProductsData, isLoading: allProductsLoading } = useQuery(
        productsListOptions({ limit: HOME_PRODUCTS_LIMIT }),
    );
    const { data: searchData, isLoading: searchLoading } = useQuery({
        ...productsListOptions({ limit: 20, searchQuery }),
        enabled: searchQuery.length > 0,
    });

    const handleSearch = useCallback((query: string) => {
        setSearchQuery(query);
    }, []);

    const categories = categoriesData?.categories ?? [];
    const allProducts = allProductsData?.products ?? [];
    const totalCount = allProductsData?.count ?? 0;
    const isSearching = searchQuery.length > 0;
    const isMainLoading = categoriesLoading || allProductsLoading;

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

                {!isSearching && isMainLoading && (
                    <motion.div
                        key="main-loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col gap-3 px-4"
                    >
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-24 w-full rounded-xl" />
                        <Skeleton className="h-24 w-full rounded-xl" />
                        <Skeleton className="h-24 w-full rounded-xl" />
                    </motion.div>
                )}

                {!isSearching && !isMainLoading && (
                    <AnimatedList key="main" className="flex flex-col gap-6 px-4 py-2">
                        {allProducts.length > 0 && (
                            <AnimatedListItem key="all-products">
                                <section className="flex flex-col gap-3">
                                    <motion.div
                                        whileTap={{ scale: 0.98 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 400,
                                            damping: 17,
                                        }}
                                    >
                                        <Link to="/products" className="flex items-center gap-2">
                                            <span className="text-foreground text-lg font-medium">
                                                {t("products")}
                                            </span>
                                            <ChevronRight className="text-muted-foreground size-6" />
                                        </Link>
                                    </motion.div>

                                    <AnimatedList className="flex flex-col gap-1.5">
                                        {allProducts.map((product) => (
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

                                    <AnimatePresence>
                                        {totalCount > HOME_PRODUCTS_LIMIT && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -5 }}
                                                whileTap={{ scale: 0.98 }}
                                                transition={{
                                                    type: "spring",
                                                    stiffness: 400,
                                                    damping: 17,
                                                }}
                                            >
                                                <Link
                                                    to="/products"
                                                    className="bg-surface text-accent flex items-center justify-center gap-1 rounded-xl py-3 text-sm font-semibold"
                                                >
                                                    {tCatalog("see_all")} ({totalCount})
                                                    <ChevronRight className="size-4" />
                                                </Link>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </section>
                            </AnimatedListItem>
                        )}

                        {categories.map((category) => (
                            <AnimatedListItem key={category.id}>
                                <CategorySection
                                    categoryId={category.id}
                                    categoryName={category.name}
                                />
                            </AnimatedListItem>
                        ))}

                        {allProducts.length === 0 && (
                            <motion.p
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-muted-foreground py-8 text-center"
                            >
                                {t("no_data")}
                            </motion.p>
                        )}
                    </AnimatedList>
                )}
            </AnimatePresence>
        </PageTransition>
    );
}

export const Route = createFileRoute("/")({
    loader: ({ context }) => {
        void context.queryClient.ensureQueryData(categoriesListOptions());
        void context.queryClient.ensureQueryData(
            productsListOptions({ limit: HOME_PRODUCTS_LIMIT }),
        );
    },
    component: HomePage,
});
