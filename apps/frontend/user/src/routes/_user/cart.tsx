import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useCartStore } from "@/stores/cart.store";
import { useCreateOrder } from "@/api/orders.api";
import { ProductCard } from "@/components/catalog/product-card";
import { Button, Checkbox } from "@jahonbozor/ui";

function formatPrice(price: number): string {
    return price.toLocaleString("ru-RU").replace(/,/g, " ");
}

function CartPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const items = useCartStore((s) => s.items);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(
        () => new Set(items.map((i) => i.productId)),
    );
    const [paymentType, setPaymentType] = useState<"CASH" | "CREDIT_CARD">("CREDIT_CARD");
    const createOrder = useCreateOrder();

    const allSelected = items.length > 0 && selectedIds.size === items.length;
    const selectedItems = items.filter((i) => selectedIds.has(i.productId));
    const totalPrice = selectedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const toggleAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(items.map((i) => i.productId)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const toggleItem = (productId: number, checked: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) {
                next.add(productId);
            } else {
                next.delete(productId);
            }
            return next;
        });
    };

    const handleBuy = async () => {
        if (selectedItems.length === 0) return;

        createOrder.mutate(
            {
                paymentType,
                items: selectedItems.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price,
                })),
            },
            {
                onSuccess: () => {
                    navigate({ to: "/orders" });
                },
            },
        );
    };

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center px-4 py-16">
                <ShoppingCart className="h-16 w-16 text-muted-foreground" />
                <p className="mt-4 text-lg text-muted-foreground">{t("empty_cart")}</p>
            </div>
        );
    }

    return (
        <div className="pb-48">
            <div className="flex items-center gap-2 border-b px-4 py-3">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                <span className="text-sm">{t("select_all")}</span>
            </div>

            <div className="flex flex-col gap-3 px-4 py-2">
            {items.map((item) => (
                <ProductCard
                    key={item.productId}
                    variant="cart"
                    productId={item.productId}
                    name={item.name}
                    price={item.price}
                    quantity={item.quantity}
                    selected={selectedIds.has(item.productId)}
                    onSelect={(checked) => toggleItem(item.productId, checked)}
                />
            ))}
            </div>

            <div className="fixed bottom-20 left-0 right-0 border-t bg-background px-4 py-3">
                <div className="mb-2 flex gap-2">
                    <button
                        onClick={() => setPaymentType("CREDIT_CARD")}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                            paymentType === "CREDIT_CARD"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground"
                        }`}
                    >
                        {t("payment_card")}
                    </button>
                    <button
                        onClick={() => setPaymentType("CASH")}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                            paymentType === "CASH"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground"
                        }`}
                    >
                        {t("payment_cash")}
                    </button>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground">
                            {t("total")}: {t("items_count", { count: selectedItems.reduce((s, i) => s + i.quantity, 0) })}
                        </p>
                        <p className="text-lg font-bold">
                            {formatPrice(totalPrice)} {t("sum")}
                        </p>
                    </div>
                    <Button
                        onClick={handleBuy}
                        disabled={selectedItems.length === 0 || createOrder.isPending}
                        className="px-8"
                    >
                        {createOrder.isPending ? t("loading") : t("buy")}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export const Route = createFileRoute("/_user/cart")({
    component: CartPage,
});
