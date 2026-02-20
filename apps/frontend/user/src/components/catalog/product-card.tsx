import { ShoppingCart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, Checkbox } from "@jahonbozor/ui";
import { useCartStore } from "@/stores/cart.store";
import { QuantityControl } from "@/components/catalog/quantity-control";

function formatPrice(price: number): string {
    return price.toLocaleString("ru-RU").replace(/,/g, " ");
}

interface CatalogProps {
    variant?: "catalog";
    id: number;
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
    const variant = props.variant ?? "catalog";

    if (variant === "cart") return <CartVariant {...(props as CartProps)} />;
    if (variant === "order") return <OrderVariant {...(props as OrderProps)} />;
    return <CatalogVariant {...(props as CatalogProps)} />;
}

function CatalogVariant({ id, name, price, remaining }: CatalogProps) {
    const { t } = useTranslation();
    const addItem = useCartStore((s) => s.addItem);
    const updateQuantity = useCartStore((s) => s.updateQuantity);
    const cartItem = useCartStore((s) => s.items.find((i) => i.productId === id));

    const handleAddToCart = () => {
        addItem({ productId: id, name, price });
    };

    return (
        <motion.div
            className="bg-surface rounded-xl px-3 py-3.5 flex flex-col gap-3"
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
            <p className="text-lg font-bold text-foreground">{name}</p>
            <div className="flex items-end justify-between">
                <div className="flex-1 grid grid-cols-2 gap-4">
                    <PriceField price={price} />
                    <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-muted-foreground">
                            {t("in_stock")}:
                        </span>
                        <ValueWithUnit value={remaining} unit={t("pieces")} />
                    </div>
                </div>
                <div className="shrink-0 flex justify-end min-w-28">
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
                                    onIncrement={() => updateQuantity(id, cartItem.quantity + 1)}
                                    onDecrement={() => updateQuantity(id, cartItem.quantity - 1)}
                                />
                            </motion.div>
                        ) : (
                            <motion.button
                                key="cart"
                                type="button"
                                onClick={handleAddToCart}
                                className="flex size-11 items-center justify-center rounded-full bg-accent"
                                aria-label={t("add_to_cart")}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                whileTap={{ scale: 0.85 }}
                                transition={{ duration: 0.12 }}
                            >
                                <ShoppingCart className="size-5 text-accent-foreground" />
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
}

function CartVariant({ productId, name, price, quantity, selected, onSelect }: CartProps) {
    const updateQuantity = useCartStore((s) => s.updateQuantity);

    return (
        <motion.div
            className="bg-surface rounded-xl px-2 py-3.5 flex items-center gap-3"
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
            <Checkbox
                checked={selected}
                onCheckedChange={(checked) => onSelect(checked === true)}
                className="size-5 rounded-sm border-foreground"
            />
            <div className="flex-1 flex flex-col gap-3">
                <p className="text-lg font-bold text-foreground">{name}</p>
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
    const { t } = useTranslation();

    return (
        <div className="bg-surface rounded-xl px-3 py-3.5 flex flex-col gap-3">
            <p className="text-lg font-bold text-foreground">{name}</p>
            <div className="flex items-center gap-4">
                <PriceField price={price} />
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-muted-foreground">
                        {t("ordered")}:
                    </span>
                    <ValueWithUnit value={quantity} unit={t("pieces")} />
                </div>
            </div>
        </div>
    );
}

function PriceField({ price }: { price: number }) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">
                {t("price")}:
            </span>
            <ValueWithUnit value={formatPrice(price)} unit={t("sum")} />
        </div>
    );
}

function ValueWithUnit({ value, unit }: { value: string | number; unit: string }) {
    return (
        <span>
            <span className="text-base font-bold text-foreground">
                {value}{" "}
            </span>
            <span className="text-base font-medium text-muted-foreground">
                {unit}
            </span>
        </span>
    );
}
