import { useTranslation } from "react-i18next";

import { Link } from "@tanstack/react-router";

import { motion } from "@jahonbozor/ui";

import { getPaymentTypeLabel } from "@/components/orders/order-status-badge";
import { formatDate, formatPrice, getLocaleCode } from "@/lib/format";
import { useUIStore } from "@/stores/ui.store";

interface OrderItem {
    id: number;
    quantity: number;
    price: number;
    product?: { name: string };
}

interface OrderCardProps {
    id: number;
    paymentType: string;
    createdAt: Date | string;
    items: OrderItem[];
}

export function OrderCard({ id, paymentType, createdAt, items }: OrderCardProps) {
    const { t } = useTranslation("orders");
    const locale = useUIStore((state) => state.locale);
    const localeCode = getLocaleCode(locale);
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return (
        <motion.div
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
            <Link
                to="/orders/$orderId"
                params={{ orderId: String(id) }}
                className="hover:bg-accent/50 block border-b px-4 py-3"
            >
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-semibold">{t("order_number", { id })}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                            {formatDate(createdAt, localeCode)}
                        </p>
                    </div>
                </div>
                <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
                    <span>
                        {t("payment_method")}: {getPaymentTypeLabel(paymentType, t)}
                    </span>
                    <span className="text-foreground text-sm font-bold">
                        {formatPrice(total, localeCode)} {t("sum")}
                    </span>
                </div>
            </Link>
        </motion.div>
    );
}
