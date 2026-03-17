import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Minus, Plus, ShoppingCart } from "lucide-react";

import { motion, PageTransition, Skeleton } from "@jahonbozor/ui";

import { productDetailOptions } from "@/api/products.api";
import { PageHeader } from "@/components/layout/page-header";
import { formatPrice, getLocaleCode } from "@/lib/format";
import { useCartStore } from "@/stores/cart.store";
import { useUIStore } from "@/stores/ui.store";

function ProductDetailPage() {
    const { productId } = Route.useParams();
    const { t } = useTranslation("catalog");
    const [quantity, setQuantity] = useState(1);
    const addItem = useCartStore((state) => state.addItem);
    const updateQuantity = useCartStore((state) => state.updateQuantity);

    const locale = useUIStore((state) => state.locale);
    const localeCode = getLocaleCode(locale);
    const { data: product, isLoading } = useQuery(productDetailOptions(Number(productId)));

    const handleAddToCart = () => {
        if (!product) return;
        const existing = useCartStore
            .getState()
            .items.find((item) => item.productId === product.id);
        if (existing) {
            updateQuantity(product.id, existing.quantity + quantity);
        } else {
            addItem({ productId: product.id, name: product.name, price: product.price });
            if (quantity > 1) {
                updateQuantity(product.id, quantity);
            }
        }
    };

    if (isLoading) {
        return (
            <PageTransition className="space-y-4 p-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-24" />
            </PageTransition>
        );
    }

    if (!product) {
        return (
            <PageTransition className="p-4 text-center">
                <p className="text-muted-foreground">{t("no_data")}</p>
            </PageTransition>
        );
    }

    const crumbs = [
        { label: t("products"), to: "/products" },
        ...(product.category?.parent
            ? [
                  {
                      label: product.category.parent.name,
                      to: `/products?categoryIds=${product.category.parent.id}`,
                  },
              ]
            : []),
        ...(product.category
            ? [{ label: product.category.name, to: `/products?categoryIds=${product.category.id}` }]
            : []),
        { label: product.name },
    ];

    return (
        <PageTransition>
            <PageHeader crumbs={crumbs} />
            <div className="px-4">
                <h1 className="text-xl font-bold">{product.name}</h1>

                <p className="text-primary mt-2 text-2xl font-bold">
                    {formatPrice(product.price, localeCode)} {t("sum")}
                </p>

                <p className="text-muted-foreground mt-1 text-sm">
                    {t("remaining")}: {product.remaining} {t("pieces")}
                </p>

                <div className="mt-6 flex items-center gap-4">
                    <div className="flex items-center rounded-lg border">
                        <motion.button
                            type="button"
                            aria-label={t("quantity") + " -1"}
                            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                            className="hover:bg-accent flex h-10 w-10 items-center justify-center"
                            whileTap={{ scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                            <Minus className="h-4 w-4" />
                        </motion.button>
                        <span className="w-10 text-center text-sm font-medium">{quantity}</span>
                        <motion.button
                            type="button"
                            aria-label={t("quantity") + " +1"}
                            onClick={() => setQuantity((q) => Math.min(product.remaining, q + 1))}
                            className="hover:bg-accent flex h-10 w-10 items-center justify-center"
                            whileTap={{ scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                            <Plus className="h-4 w-4" />
                        </motion.button>
                    </div>

                    <motion.button
                        type="button"
                        onClick={handleAddToCart}
                        className="bg-primary text-primary-foreground inline-flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                        <ShoppingCart className="h-4 w-4" />
                        {t("add_to_cart")}
                    </motion.button>
                </div>
            </div>
        </PageTransition>
    );
}

export const Route = createFileRoute("/_public/products/$productId")({
    loader: ({ context, params }) => {
        void context.queryClient.ensureQueryData(productDetailOptions(Number(params.productId)));
    },
    component: ProductDetailPage,
});
