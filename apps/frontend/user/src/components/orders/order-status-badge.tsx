export function getPaymentTypeLabel(
    paymentType: string,
    t: (key: string, options?: Record<string, string>) => string,
): string {
    if (paymentType === "CREDIT_CARD") return t("payment_card");
    if (paymentType === "DEBT") return t("payment_debt");
    return t("payment_cash");
}
