import { useState } from "react";
import { useTranslation } from "react-i18next";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";

import {
    AnimatedList,
    AnimatedListItem,
    Checkbox,
    cn,
    Input,
    motion,
    PageTransition,
} from "@jahonbozor/ui";

import { useCreateOrder } from "@/api/orders.api";
import { ProductCard } from "@/components/catalog/product-card";
import { formatPrice, getLocaleCode } from "@/lib/format";
import { useCartStore } from "@/stores/cart.store";
import { useUIStore } from "@/stores/ui.store";

const PAYMENT_TYPES = [
    { value: "CREDIT_CARD", labelKey: "payment_card" },
    { value: "CASH", labelKey: "payment_cash" },
    { value: "DEBT", labelKey: "payment_debt" },
] as const;

function CartPage() {
    const { t } = useTranslation("cart");
    const navigate = useNavigate();
    const locale = useUIStore((state) => state.locale);
    const localeCode = getLocaleCode(locale);
    const items = useCartStore((state) => state.items);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(
        () => new Set(items.map((item) => item.productId)),
    );
    const [paymentType, setPaymentType] = useState<"CASH" | "CREDIT_CARD" | "DEBT">("CREDIT_CARD");
    const [comment, setComment] = useState("");
    const createOrder = useCreateOrder();

    const allSelected = items.length > 0 && selectedIds.size === items.length;
    const selectedItems = items.filter((item) => selectedIds.has(item.productId));
    const totalPrice = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const toggleAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(items.map((item) => item.productId)));
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

    const handleBuy = () => {
        if (selectedItems.length === 0) return;

        createOrder.mutate(
            {
                paymentType,
                comment: comment.trim() || null,
                items: selectedItems.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price,
                })),
            },
            {
                onSuccess: () => {
                    void navigate({ to: "/orders" });
                },
            },
        );
    };

    if (items.length === 0) {
        return (
            <PageTransition className="flex flex-col items-center justify-center px-4 py-16">
                <ShoppingCart className="text-muted-foreground h-16 w-16" />
                <p className="text-muted-foreground mt-4 text-lg">{t("empty_cart")}</p>
            </PageTransition>
        );
    }

    return (
        <PageTransition className="pb-52">
            <div className="flex items-center gap-2 border-b px-4 py-3">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                <span className="text-sm">{t("select_all")}</span>
            </div>

            <AnimatedList className="flex flex-col gap-3 px-4 py-2">
                {items.map((item) => (
                    <AnimatedListItem key={item.productId}>
                        <ProductCard
                            variant="cart"
                            productId={item.productId}
                            name={item.name}
                            price={item.price}
                            quantity={item.quantity}
                            selected={selectedIds.has(item.productId)}
                            onSelect={(checked) => toggleItem(item.productId, checked)}
                        />
                    </AnimatedListItem>
                ))}
            </AnimatedList>

            <div className="bg-background fixed right-0 bottom-20 left-0 border-t px-4 py-3">
                <div className="mb-3">
                    <Input
                        placeholder={t("order_comment")}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="h-9 text-sm"
                    />
                </div>
                <div className="hide-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1">
                    {PAYMENT_TYPES.map(({ value, labelKey }) => (
                        <motion.button
                            key={value}
                            type="button"
                            onClick={() => setPaymentType(value)}
                            className={cn(
                                "rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap",
                                paymentType === value
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary text-secondary-foreground",
                            )}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                            {t(labelKey)}
                        </motion.button>
                    ))}
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-muted-foreground text-xs">
                            {t("total")}:{" "}
                            {t("items_count", {
                                count: selectedItems.reduce((sum, item) => sum + item.quantity, 0),
                            })}
                        </p>
                        <p className="text-lg font-bold">
                            {formatPrice(totalPrice, localeCode)} {t("sum")}
                        </p>
                    </div>
                    <motion.button
                        type="button"
                        onClick={handleBuy}
                        disabled={selectedItems.length === 0 || createOrder.isPending}
                        className="bg-primary text-primary-foreground rounded-md px-8 py-2 text-sm font-medium disabled:opacity-50"
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                        {createOrder.isPending ? t("loading") : t("buy")}
                    </motion.button>
                </div>
            </div>
        </PageTransition>
    );
}

export const Route = createFileRoute("/_user/cart")({
    component: CartPage,
});
