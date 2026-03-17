import { useTranslation } from "react-i18next";
import { Badge } from "@jahonbozor/ui";

interface OrderStatusBadgeProps {
    status: string;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
    const { t } = useTranslation();

    return (
        <Badge
            variant={status === "NEW" ? "default" : status === "CANCELLED" ? "destructive" : "secondary"}
            className={status === "NEW" ? "bg-primary" : status === "CANCELLED" ? "" : "bg-accent text-accent-foreground"}
        >
            {status === "NEW"
                ? t("status_new")
                : status === "CANCELLED"
                  ? t("status_cancelled")
                  : t("status_accepted")}
        </Badge>
    );
}

export function getPaymentTypeLabel(paymentType: string, t: (key: string, options?: Record<string, string>) => string): string {
    if (paymentType === "CREDIT_CARD") return t("payment_card");
    if (paymentType === "DEBT") return t("payment_debt");
    return t("payment_cash");
}
