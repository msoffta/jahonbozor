import { ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@jahonbozor/ui";
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
            <Link
                to="/products"
                search={{ categoryIds: String(categoryId) }}
                className="flex items-center gap-2"
            >
                <span className="text-lg font-medium text-foreground">{categoryName}</span>
                <ChevronRight className="size-6 text-black/40" />
            </Link>

            {isLoading && (
                <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                </div>
            )}

            {!isLoading && products.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    {products.map((product) => (
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

            {totalCount > 10 && (
                <Link
                    to="/products"
                    search={{ categoryIds: String(categoryId) }}
                    className="flex items-center justify-center gap-1 rounded-xl bg-surface py-3 text-sm font-semibold text-accent active:scale-[0.98] transition-transform"
                >
                    {t("see_all")} ({totalCount})
                    <ChevronRight className="size-4" />
                </Link>
            )}
        </section>
    );
}
