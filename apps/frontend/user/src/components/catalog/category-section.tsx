import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { Skeleton, motion, AnimatePresence, AnimatedList, AnimatedListItem } from "@jahonbozor/ui";
import { productsListOptions } from "@/api/products.api";
import { ProductCard } from "./product-card";

interface CategorySectionProps {
    categoryId: number;
    categoryName: string;
}

export function CategorySection({ categoryId, categoryName }: CategorySectionProps) {
    const { t } = useTranslation();
    const { data, isLoading } = useQuery(
        productsListOptions({ limit: 10, categoryIds: [categoryId] }),
    );

    const products = data?.products ?? [];
    const totalCount = data?.count ?? 0;

    if (!isLoading && products.length === 0) return null;

    return (
        <section className="flex flex-col gap-3">
            <motion.div whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 400, damping: 17 }}>
                <Link
                    to="/products"
                    search={{ categoryIds: String(categoryId) }}
                    className="flex items-center gap-2"
                >
                    <span className="text-lg font-medium text-foreground">{categoryName}</span>
                    <ChevronRight className="size-6 text-muted-foreground" />
                </Link>
            </motion.div>

            <AnimatePresence mode="wait">
                {isLoading && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col gap-1.5"
                    >
                        <Skeleton className="h-24 w-full rounded-xl" />
                        <Skeleton className="h-24 w-full rounded-xl" />
                        <Skeleton className="h-24 w-full rounded-xl" />
                    </motion.div>
                )}

                {!isLoading && products.length > 0 && (
                    <AnimatedList key="products" className="flex flex-col gap-1.5">
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

            <AnimatePresence>
                {totalCount > 10 && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                        <Link
                            to="/products"
                            search={{ categoryIds: String(categoryId) }}
                            className="flex items-center justify-center gap-1 rounded-xl bg-surface py-3 text-sm font-semibold text-accent"
                        >
                            {t("see_all")} ({totalCount})
                            <ChevronRight className="size-4" />
                        </Link>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}
