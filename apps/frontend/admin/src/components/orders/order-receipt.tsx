import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";

import { format } from "date-fns";

import { formatCurrency } from "@/lib/format";

export interface ReceiptItem {
    name: string;
    quantity: number;
    price: number;
}

export interface OrderReceiptProps {
    orderId?: number;
    clientName?: string | null;
    date?: string | Date;
    paymentType?: string;
    comment?: string | null;
    items: ReceiptItem[];
    totalSum: number;
    pageBreak?: boolean;
}

export function OrderReceipt({
    orderId,
    clientName,
    date,
    paymentType,
    comment,
    items,
    totalSum,
    pageBreak,
}: OrderReceiptProps) {
    const { t } = useTranslation("orders");
    const currencyLabel = t("common:sum");

    return (
        <div
            className="print-receipt"
            style={pageBreak ? { pageBreakBefore: "always" } : undefined}
            aria-hidden="true"
        >
            {/* Logo */}
            <div className="receipt-logo">
                <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Jahon Bozor" />
            </div>

            {/* Order info */}
            {(orderId ?? date ?? clientName ?? paymentType) && (
                <>
                    <div className="receipt-info">
                        {orderId && <div>{t("receipt_order_number", { number: orderId })}</div>}
                        {date && (
                            <div>
                                {t("receipt_date")}: {format(new Date(date), "dd.MM.yyyy HH:mm")}
                            </div>
                        )}
                        {clientName && (
                            <div>
                                {t("receipt_client")}: {clientName}
                            </div>
                        )}
                        {paymentType && (
                            <div>
                                {t("receipt_payment")}: {t(`payment_${paymentType.toLowerCase()}`)}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Items table */}
            <div className="receipt-divider" />
            <table className="receipt-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>{t("receipt_product")}</th>
                        <th>{t("receipt_qty")}</th>
                        <th>{t("receipt_price")}</th>
                        <th>{t("receipt_item_total")}</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{item.name}</td>
                            <td>{item.quantity}</td>
                            <td>{formatCurrency(item.price, currencyLabel)}</td>
                            <td>{formatCurrency(item.price * item.quantity, currencyLabel)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Total */}
            <div className="receipt-divider" />
            <div className="receipt-total">
                {t("receipt_total")}: {formatCurrency(totalSum, currencyLabel)}
            </div>

            {/* Comment */}
            {comment && (
                <div className="receipt-comment">
                    {t("receipt_comment")}: {comment}
                </div>
            )}

            {/* Footer */}
            <div className="receipt-divider" />
            <div className="receipt-footer">{t("receipt_thank_you")}</div>
        </div>
    );
}

export interface OrderReceiptContainerProps {
    receipts: OrderReceiptProps[];
}

export function OrderReceiptContainer({ receipts }: OrderReceiptContainerProps) {
    if (receipts.length === 0) return null;

    return createPortal(
        <div className="print-receipt-container hidden print:block">
            {receipts.map((receipt, index) => (
                <OrderReceipt key={index} {...receipt} pageBreak={index > 0} />
            ))}
        </div>,
        document.body,
    );
}
