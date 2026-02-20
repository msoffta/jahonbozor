import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { productDetailOptions } from "@/api/products.api";
import { useCartStore } from "@/stores/cart.store";
import { Button, Skeleton } from "@jahonbozor/ui";
import { PageHeader } from "@/components/layout/page-header";

function formatPrice(price: number): string {
    return price.toLocaleString("ru-RU").replace(/,/g, " ");
}

function ProductDetailPage() {
    const { productId } = Route.useParams();
    const { t } = useTranslation();
    const [quantity, setQuantity] = useState(1);
    const addItem = useCartStore((s) => s.addItem);

    const { data: product, isLoading } = useQuery(productDetailOptions(Number(productId)));

    const handleAddToCart = () => {
        if (!product) return;
        for (let i = 0; i < quantity; i++) {
            addItem({ productId: product.id, name: product.name, price: product.price });
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-4 p-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-24" />
            </div>
        );
    }

    if (!product) {
        return (
            <div className="p-4 text-center">
                <p className="text-muted-foreground">{t("no_data")}</p>
            </div>
        );
    }

    const crumbs = [
        { label: t("products"), to: "/products" },
        ...(product.category?.parent
            ? [{ label: product.category.parent.name, to: `/products?categoryIds=${product.category.parent.id}` }]
            : []),
        ...(product.category
            ? [{ label: product.category.name, to: `/products?categoryIds=${product.category.id}` }]
            : []),
        { label: product.name },
    ];

    return (
        <div>
            <PageHeader crumbs={crumbs} />
            <div className="px-4">

            <h1 className="text-xl font-bold">{product.name}</h1>

            <p className="mt-2 text-2xl font-bold text-primary">
                {formatPrice(product.price)} {t("sum")}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
                {t("remaining")}: {product.remaining} {t("pieces")}
            </p>

            <div className="mt-6 flex items-center gap-4">
                <div className="flex items-center rounded-lg border">
                    <button
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="flex h-10 w-10 items-center justify-center hover:bg-accent"
                    >
                        <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-10 text-center text-sm font-medium">{quantity}</span>
                    <button
                        onClick={() => setQuantity((q) => Math.min(product.remaining, q + 1))}
                        className="flex h-10 w-10 items-center justify-center hover:bg-accent"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                </div>

                <Button onClick={handleAddToCart} className="flex-1 gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    {t("add_to_cart")}
                </Button>
            </div>
            </div>
        </div>
    );
}

export const Route = createFileRoute("/_public/products/$productId")({
    component: ProductDetailPage,
});
