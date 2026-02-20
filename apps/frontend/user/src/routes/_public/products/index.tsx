import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState, useCallback, useEffect, useRef } from "react";
import { SearchBar } from "@/components/catalog/search-bar";
import { ProductCard } from "@/components/catalog/product-card";
import { productsInfiniteOptions } from "@/api/products.api";
import { categoriesListOptions } from "@/api/categories.api";
import { Skeleton, cn, Checkbox, Button, Drawer, DrawerHeader, DrawerTitle, motion } from "@jahonbozor/ui";
import { Ellipsis, Loader2, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

interface ProductsSearch {
    categoryIds?: string;
    searchQuery?: string;
}

function ProductsPage() {
    const { t } = useTranslation();
    const { categoryIds: initialCategoryIds } = Route.useSearch();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(
        () => {
            if (!initialCategoryIds) return new Set();
            const ids = initialCategoryIds.split(",").map(Number).filter((n) => !isNaN(n));
            return new Set(ids);
        },
    );
    const [pendingCategoryIds, setPendingCategoryIds] = useState<Set<number>>(new Set());
    const [drawerOpen, setDrawerOpen] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);

    const { data: categoriesData } = useQuery(categoriesListOptions());
    const categoryIdsArray = selectedCategoryIds.size > 0 ? [...selectedCategoryIds] : undefined;
    const {
        data,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
    } = useInfiniteQuery(
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
                    fetchNextPage();
                }
            },
            { rootMargin: "200px" },
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const categories = categoriesData?.categories ?? [];
    const VISIBLE_COUNT = 3;
    const visibleCategories = categories.slice(0, VISIBLE_COUNT);
    const hasMore = categories.length > VISIBLE_COUNT;
    const products = data?.pages.flatMap((page) => page.products) ?? [];

    return (
        <div>
            <PageHeader crumbs={[{ label: t("home"), to: "/" }, { label: t("products") }]} />
            <div className="sticky top-14 z-40 bg-background">
                <SearchBar value={searchQuery} onChange={handleSearch} />

                {categories.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide">
                        <button
                            onClick={() => setSelectedCategoryIds(new Set())}
                            className={cn(
                                "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                                selectedCategoryIds.size === 0
                                    ? "bg-accent text-accent-foreground"
                                    : "bg-surface text-foreground",
                            )}
                        >
                            {t("all")}
                        </button>
                        {visibleCategories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategoryIds(new Set([cat.id]))}
                                className={cn(
                                    "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                                    selectedCategoryIds.has(cat.id)
                                        ? "bg-accent text-accent-foreground"
                                        : "bg-surface text-foreground",
                                )}
                            >
                                {cat.name}
                            </button>
                        ))}
                        {hasMore && (
                            <button
                                onClick={handleOpenDrawer}
                                className="shrink-0 flex items-center justify-center size-9 rounded-full bg-surface text-foreground"
                                aria-label={t("more")}
                            >
                                <Ellipsis className="size-5" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            <Drawer open={drawerOpen} onOpenChange={handleDrawerClose}>
                <DrawerHeader className="flex items-center justify-between">
                    <DrawerTitle>{t("categories")}</DrawerTitle>
                    <button
                        onClick={() => setDrawerOpen(false)}
                        className="flex items-center justify-center size-8 rounded-full bg-surface text-muted-foreground active:opacity-70"
                    >
                        <X className="size-5" />
                    </button>
                </DrawerHeader>
                <div className="overflow-y-auto px-4 pb-4">
                    {categories.map((cat) => (
                        <div key={cat.id} className="flex flex-col">
                            <div
                                role="button"
                                onClick={() => handleTogglePending(cat.id)}
                                className="flex items-center gap-3 py-3 text-base font-semibold text-foreground active:opacity-70 cursor-pointer"
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
                                    className="flex items-center gap-3 py-2.5 pl-4 text-sm text-foreground active:opacity-70 cursor-pointer"
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
                <div className="flex gap-3 px-4 pb-6 pt-2 border-t border-border">
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={handleReset}
                    >
                        {t("reset")}
                    </Button>
                    <Button
                        className="flex-1"
                        onClick={handleApply}
                    >
                        {t("apply")}
                    </Button>
                </div>
            </Drawer>

            {isLoading && (
                <div className="flex flex-col gap-1.5 px-4 py-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-xl" />
                    ))}
                </div>
            )}

            {!isLoading && products.length === 0 && (
                <p className="px-4 py-8 text-center text-muted-foreground">
                    {t("no_data")}
                </p>
            )}

            {!isLoading && products.length > 0 && (
                <motion.div
                    key={searchQuery + categoryIdsArray?.join()}
                    className="flex flex-col gap-1.5 px-4 py-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                >
                    {products.map((product) => (
                        <ProductCard
                            key={product.id}
                            id={product.id}
                            name={product.name}
                            price={product.price}
                            remaining={product.remaining}
                        />
                    ))}
                </motion.div>
            )}

            {isFetchingNextPage && (
                <div className="flex justify-center py-4">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
            )}

            <div ref={sentinelRef} className="h-1" />
        </div>
    );
}

export const Route = createFileRoute("/_public/products/")({
    component: ProductsPage,
    validateSearch: (search: Record<string, unknown>): ProductsSearch => ({
        categoryIds: search.categoryIds ? String(search.categoryIds) : undefined,
        searchQuery: search.searchQuery ? String(search.searchQuery) : undefined,
    }),
});
