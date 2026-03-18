import { useTranslation } from "react-i18next";

import { ShoppingCart } from "lucide-react";

import { AnimatePresence, Checkbox, motion } from "@jahonbozor/ui";

import { QuantityControl } from "@/components/catalog/quantity-control";
import { formatPrice, getLocaleCode } from "@/lib/format";
import { useCartStore } from "@/stores/cart.store";
import { useUIStore } from "@/stores/ui.store";

interface CatalogProps {
    variant?: "catalog";
    productId: number;
    name: string;
    price: number;
    remaining: number;
}

interface CartProps {
    variant: "cart";
    productId: number;
    name: string;
    price: number;
    quantity: number;
    selected: boolean;
    onSelect: (checked: boolean) => void;
}

interface OrderProps {
    variant: "order";
    name: string;
    price: number;
    quantity: number;
}

type ProductCardProps = CatalogProps | CartProps | OrderProps;

export function ProductCard(props: ProductCardProps) {
    if (props.variant === "cart") return <CartVariant {...props} />;
    if (props.variant === "order") return <OrderVariant {...props} />;
    return <CatalogVariant {...props} />;
}

function CatalogVariant({ productId, name, price, remaining }: CatalogProps) {
    const { t } = useTranslation("catalog");
    const addItem = useCartStore((state) => state.addItem);
    const updateQuantity = useCartStore((state) => state.updateQuantity);
    const cartItem = useCartStore((state) =>
        state.items.find((item) => item.productId === productId),
    );

    const handleAddToCart = () => {
        addItem({ productId, name, price });
    };

    return (
        <motion.div
            className="bg-surface flex flex-col gap-3 rounded-xl px-3 py-3.5"
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
            <p className="text-foreground text-lg font-bold">{name}</p>
            <div className="flex items-end justify-between">
                <div className="grid flex-1 grid-cols-2 gap-4">
                    <PriceField price={price} />
                    <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground text-sm font-medium">
                            {t("in_stock")}:
                        </span>
                        <ValueWithUnit value={remaining} unit={t("pieces")} />
                    </div>
                </div>
                <div className="flex min-w-28 shrink-0 justify-end">
                    <AnimatePresence mode="wait" initial={false}>
                        {cartItem ? (
                            <motion.div
                                key="qty"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                transition={{ duration: 0.12 }}
                            >
                                <QuantityControl
                                    quantity={cartItem.quantity}
                                    onIncrement={() =>
                                        updateQuantity(productId, cartItem.quantity + 1)
                                    }
                                    onDecrement={() =>
                                        updateQuantity(productId, cartItem.quantity - 1)
                                    }
                                />
                            </motion.div>
                        ) : (
                            <motion.button
                                key="cart"
                                type="button"
                                onClick={handleAddToCart}
                                className="bg-accent flex size-11 items-center justify-center rounded-full"
                                aria-label={t("add_to_cart")}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                whileTap={{ scale: 0.85 }}
                                transition={{ duration: 0.12 }}
                            >
                                <ShoppingCart className="text-accent-foreground size-5" />
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
}

function CartVariant({ productId, name, price, quantity, selected, onSelect }: CartProps) {
    const updateQuantity = useCartStore((state) => state.updateQuantity);

    return (
        <motion.div
            className="bg-surface flex items-center gap-3 rounded-xl px-2 py-3.5"
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
            <Checkbox
                checked={selected}
                onCheckedChange={(checked) => onSelect(checked === true)}
                className="border-foreground size-5 rounded-sm"
            />
            <div className="flex flex-1 flex-col gap-3">
                <p className="text-foreground text-lg font-bold">{name}</p>
                <div className="flex items-end justify-between">
                    <PriceField price={price} />
                    <QuantityControl
                        quantity={quantity}
                        onIncrement={() => updateQuantity(productId, quantity + 1)}
                        onDecrement={() => updateQuantity(productId, quantity - 1)}
                    />
                </div>
            </div>
        </motion.div>
    );
}

function OrderVariant({ name, price, quantity }: OrderProps) {
    const { t } = useTranslation("catalog");

    return (
        <div className="bg-surface flex flex-col gap-3 rounded-xl px-3 py-3.5">
            <p className="text-foreground text-lg font-bold">{name}</p>
            <div className="flex items-center gap-4">
                <PriceField price={price} />
                <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-sm font-medium">
                        {t("ordered")}:
                    </span>
                    <ValueWithUnit value={quantity} unit={t("pieces")} />
                </div>
            </div>
        </div>
    );
}

function PriceField({ price }: { price: number }) {
    const { t } = useTranslation("catalog");
    const locale = useUIStore((state) => state.locale);
    const localeCode = getLocaleCode(locale);
    return (
        <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-sm font-medium">{t("price")}:</span>
            <ValueWithUnit value={formatPrice(price, localeCode)} unit={t("sum")} />
        </div>
    );
}

function ValueWithUnit({ value, unit }: { value: string | number; unit: string }) {
    return (
        <span>
            <span className="text-foreground text-base font-bold">{value} </span>
            <span className="text-muted-foreground text-base font-medium">{unit}</span>
        </span>
    );
}
