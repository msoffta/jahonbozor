import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useCartStore } from "@/stores/cart.store";
import { useUIStore } from "@/stores/ui.store";
import { useCreateOrder } from "@/api/orders.api";
import { ProductCard } from "@/components/catalog/product-card";
import { Checkbox, cn, Input, PageTransition, motion, AnimatedList, AnimatedListItem } from "@jahonbozor/ui";
import { formatPrice, getLocaleCode } from "@/lib/format";

function CartPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const locale = useUIStore((state) => state.locale);
    const loc = getLocaleCode(locale);
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

    const handleBuy = async () => {
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
                    navigate({ to: "/orders" });
                },
            },
        );
    };

    if (items.length === 0) {
        return (
            <PageTransition className="flex flex-col items-center justify-center px-4 py-16">
                <ShoppingCart className="h-16 w-16 text-muted-foreground" />
                <p className="mt-4 text-lg text-muted-foreground">{t("empty_cart")}</p>
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

            <div className="fixed bottom-20 left-0 right-0 border-t bg-background px-4 py-3">
                <div className="mb-3">
                    <Input
                        placeholder={t("order_comment")}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="h-9 text-sm"
                    />
                </div>
                <div className="mb-2 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                    <motion.button
                        type="button"
                        onClick={() => setPaymentType("CREDIT_CARD")}
                        className={cn(
                            "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium",
                            paymentType === "CREDIT_CARD"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground",
                        )}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                        {t("payment_card")}
                    </motion.button>
                    <motion.button
                        type="button"
                        onClick={() => setPaymentType("CASH")}
                        className={cn(
                            "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium",
                            paymentType === "CASH"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground",
                        )}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                        {t("payment_cash")}
                    </motion.button>
                    <motion.button
                        type="button"
                        onClick={() => setPaymentType("DEBT")}
                        className={cn(
                            "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium",
                            paymentType === "DEBT"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground",
                        )}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                        {t("payment_debt")}
                    </motion.button>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground">
                            {t("total")}: {t("items_count", { count: selectedItems.reduce((sum, item) => sum + item.quantity, 0) })}
                        </p>
                        <p className="text-lg font-bold">
                            {formatPrice(totalPrice, loc)} {t("sum")}
                        </p>
                    </div>
                    <motion.button
                        type="button"
                        onClick={handleBuy}
                        disabled={selectedItems.length === 0 || createOrder.isPending}
                        className="rounded-md bg-primary px-8 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
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
