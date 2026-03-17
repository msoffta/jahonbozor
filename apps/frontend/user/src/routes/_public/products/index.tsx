import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Ellipsis, Loader2, X } from "lucide-react";

import {
    AnimatedList,
    AnimatedListItem,
    AnimatePresence,
    Checkbox,
    cn,
    Drawer,
    DrawerHeader,
    DrawerTitle,
    motion,
    PageTransition,
    Skeleton,
} from "@jahonbozor/ui";

import { categoriesListOptions } from "@/api/categories.api";
import { productsInfiniteOptions } from "@/api/products.api";
import { ProductCard } from "@/components/catalog/product-card";
import { SearchBar } from "@/components/catalog/search-bar";
import { PageHeader } from "@/components/layout/page-header";

const VISIBLE_CATEGORY_COUNT = 3;

interface ProductsSearch {
    categoryIds?: string;
    searchQuery?: string;
}

function ProductsPage() {
    const { t } = useTranslation();
    const { categoryIds: initialCategoryIds } = Route.useSearch();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(() => {
        if (!initialCategoryIds) return new Set();
        const ids = initialCategoryIds
            .split(",")
            .map(Number)
            .filter((n) => !isNaN(n));
        return new Set(ids);
    });
    const [pendingCategoryIds, setPendingCategoryIds] = useState<Set<number>>(() => new Set());
    const [drawerOpen, setDrawerOpen] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);

    const { data: categoriesData } = useQuery(categoriesListOptions());
    const categoryIdsArray = selectedCategoryIds.size > 0 ? [...selectedCategoryIds] : undefined;
    const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteQuery(
        productsInfiniteOptions({ limit: 20, searchQuery, categoryIds: categoryIdsArray }),
    );

    const handleSearch = useCallback((query: string) => {
        setSearchQuery(query);
    }, []);

    const handleOpenDrawer = useCallback(() => {
        setPendingCategoryIds(new Set(selectedCategoryIds));
        setDrawerOpen(true);
    }, [selectedCategoryIds]);

    const handleDrawerClose = useCallback((open: boolean) => {
        if (!open) setDrawerOpen(false);
    }, []);

    const handleTogglePending = useCallback((id: number) => {
        setPendingCategoryIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleApply = useCallback(() => {
        setSelectedCategoryIds(new Set(pendingCategoryIds));
        setDrawerOpen(false);
    }, [pendingCategoryIds]);

    const handleReset = useCallback(() => {
        setPendingCategoryIds(new Set());
    }, []);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                    void fetchNextPage();
                }
            },
            { rootMargin: "200px" },
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const categories = categoriesData?.categories ?? [];
    const visibleCategories = categories.slice(0, VISIBLE_CATEGORY_COUNT);
    const hasMore = categories.length > VISIBLE_CATEGORY_COUNT;
    const products = data?.pages.flatMap((page) => page.products) ?? [];

    return (
        <PageTransition>
            <PageHeader crumbs={[{ label: t("home"), to: "/" }, { label: t("products") }]} />
            <div className="bg-background sticky top-14 z-40">
                <SearchBar value={searchQuery} onChange={handleSearch} />

                {categories.length > 0 && (
                    <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4 pb-2">
                        <motion.button
                            type="button"
                            onClick={() => setSelectedCategoryIds(new Set())}
                            className={cn(
                                "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                                selectedCategoryIds.size === 0
                                    ? "bg-accent text-accent-foreground"
                                    : "bg-surface text-foreground",
                            )}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                            {t("all")}
                        </motion.button>
                        {visibleCategories.map((cat) => (
                            <motion.button
                                type="button"
                                key={cat.id}
                                onClick={() => setSelectedCategoryIds(new Set([cat.id]))}
                                className={cn(
                                    "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                                    selectedCategoryIds.has(cat.id)
                                        ? "bg-accent text-accent-foreground"
                                        : "bg-surface text-foreground",
                                )}
                                whileTap={{ scale: 0.95 }}
                                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            >
                                {cat.name}
                            </motion.button>
                        ))}
                        {hasMore && (
                            <motion.button
                                type="button"
                                onClick={handleOpenDrawer}
                                className="bg-surface text-foreground flex size-9 shrink-0 items-center justify-center rounded-full"
                                aria-label={t("more")}
                                whileTap={{ scale: 0.9 }}
                                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            >
                                <Ellipsis className="size-5" />
                            </motion.button>
                        )}
                    </div>
                )}
            </div>

            <Drawer open={drawerOpen} onOpenChange={handleDrawerClose}>
                <DrawerHeader className="flex items-center justify-between">
                    <DrawerTitle>{t("categories")}</DrawerTitle>
                    <motion.button
                        type="button"
                        onClick={() => setDrawerOpen(false)}
                        className="bg-surface text-muted-foreground flex size-8 items-center justify-center rounded-full active:opacity-70"
                        whileTap={{ scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                        <X className="size-5" />
                    </motion.button>
                </DrawerHeader>
                <div className="overflow-y-auto px-4 pb-4">
                    {categories.map((cat) => (
                        <div key={cat.id} className="flex flex-col">
                            <div
                                role="button"
                                onClick={() => handleTogglePending(cat.id)}
                                className="text-foreground flex items-center gap-3 py-3 text-base font-semibold active:opacity-70"
                            >
                                <Checkbox
                                    checked={pendingCategoryIds.has(cat.id)}
                                    onCheckedChange={() => handleTogglePending(cat.id)}
                                    className="pointer-events-none"
                                />
                                {cat.name}
                            </div>
                            {cat.children.map((child) => (
                                <div
                                    role="button"
                                    key={child.id}
                                    onClick={() => handleTogglePending(child.id)}
                                    className="text-foreground flex items-center gap-3 py-2.5 pl-4 text-sm active:opacity-70"
                                >
                                    <Checkbox
                                        checked={pendingCategoryIds.has(child.id)}
                                        onCheckedChange={() => handleTogglePending(child.id)}
                                        className="pointer-events-none"
                                    />
                                    {child.name}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
                <div className="border-border flex gap-3 border-t px-4 pt-2 pb-6">
                    <motion.button
                        type="button"
                        className="border-input bg-background flex-1 rounded-md border px-4 py-2 text-sm font-medium"
                        onClick={handleReset}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                        {t("reset")}
                    </motion.button>
                    <motion.button
                        type="button"
                        className="bg-primary text-primary-foreground flex-1 rounded-md px-4 py-2 text-sm font-medium"
                        onClick={handleApply}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                        {t("apply")}
                    </motion.button>
                </div>
            </Drawer>

            <AnimatePresence mode="wait">
                {isLoading && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col gap-1.5 px-4 py-2"
                    >
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-24 w-full rounded-xl" />
                        ))}
                    </motion.div>
                )}

                {!isLoading && products.length === 0 && (
                    <motion.p
                        key="empty"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-muted-foreground px-4 py-8 text-center"
                    >
                        {t("no_data")}
                    </motion.p>
                )}

                {!isLoading && products.length > 0 && (
                    <AnimatedList
                        key={searchQuery + categoryIdsArray?.join()}
                        className="flex flex-col gap-1.5 px-4 py-2"
                    >
                        {products.map((product) => (
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
            </AnimatePresence>

            {isFetchingNextPage && (
                <div className="flex justify-center py-4">
                    <Loader2 className="text-muted-foreground size-5 animate-spin" />
                </div>
            )}

            <div ref={sentinelRef} className="h-1" />
        </PageTransition>
    );
}

export const Route = createFileRoute("/_public/products/")({
    component: ProductsPage,
    validateSearch: (search: Record<string, unknown>): ProductsSearch => ({
        categoryIds: typeof search.categoryIds === "string" ? search.categoryIds : undefined,
        searchQuery: typeof search.searchQuery === "string" ? search.searchQuery : undefined,
    }),
});
