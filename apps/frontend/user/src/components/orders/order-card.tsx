import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Badge } from "@jahonbozor/ui";
import { useUIStore } from "@/stores/ui.store";

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

function formatPrice(price: number, locale: string): string {
    return price.toLocaleString(locale).replace(/,/g, " ");
}

function formatDate(dateStr: Date | string, locale: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function OrderCard({ id, status, paymentType, createdAt, items }: OrderCardProps) {
    const { t } = useTranslation();
    const locale = useUIStore((s) => s.locale);
    const loc = locale === "uz" ? "uz-UZ" : "ru-RU";
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return (
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
                <Badge
                    variant={status === "NEW" ? "default" : status === "CANCELLED" ? "destructive" : "secondary"}
                    className={status === "NEW" ? "bg-primary" : status === "CANCELLED" ? "" : "bg-green-600 text-white"}
                >
                    {status === "NEW" ? t("status_new") : status === "CANCELLED" ? t("status_cancelled") : t("status_accepted")}
                </Badge>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                    {t("payment_method")}: {paymentType === "CREDIT_CARD" ? t("payment_card") : t("payment_cash")}
                </span>
                <span className="text-sm font-bold text-foreground">
                    {formatPrice(total, loc)} {t("sum")}
                </span>
            </div>
        </Link>
    );
}
