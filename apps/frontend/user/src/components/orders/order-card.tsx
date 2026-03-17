import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion } from "@jahonbozor/ui";
import { useUIStore } from "@/stores/ui.store";
import { OrderStatusBadge, getPaymentTypeLabel } from "@/components/orders/order-status-badge";
import { formatPrice, formatDate, getLocaleCode } from "@/lib/format";

interface OrderItem {
    id: number;
    quantity: number;
    price: number;
    product?: { name: string };
}

interface OrderCardProps {
    id: number;
    status: string;
    paymentType: string;
    createdAt: Date | string;
    items: OrderItem[];
}

export function OrderCard({ id, status, paymentType, createdAt, items }: OrderCardProps) {
    const { t } = useTranslation();
    const locale = useUIStore((state) => state.locale);
    const loc = getLocaleCode(locale);
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return (
        <motion.div whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 400, damping: 17 }}>
            <Link
                to="/orders/$orderId"
                params={{ orderId: String(id) }}
                className="block border-b px-4 py-3 hover:bg-accent/50"
            >
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-semibold">
                            {t("order_number", { id })}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatDate(createdAt, loc)}
                        </p>
                    </div>
                    <OrderStatusBadge status={status} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                        {t("payment_method")}: {getPaymentTypeLabel(paymentType, t)}
                    </span>
                    <span className="text-sm font-bold text-foreground">
                        {formatPrice(total, loc)} {t("sum")}
                    </span>
                </div>
            </Link>
        </motion.div>
    );
}
