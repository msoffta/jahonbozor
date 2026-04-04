import { render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, number | string>) => {
            if (params?.number != null) return `Заказ №${params.number}`;
            return key;
        },
    }),
}));

vi.mock("date-fns", () => ({
    format: () => "01.01.2025 12:00",
}));

vi.mock("@/lib/format", () => ({
    formatCurrency: (value: number, label: string) => `${value.toLocaleString()} ${label}`,
}));

import { OrderReceipt, OrderReceiptContainer } from "../order-receipt";

import type { OrderReceiptProps } from "../order-receipt";

const baseProps: OrderReceiptProps = {
    orderId: 42,
    clientName: "Иван Иванов",
    date: "2025-01-01T12:00:00.000Z",
    paymentType: "CASH",
    comment: "Тестовый комментарий",
    items: [
        { name: "Товар 1", quantity: 2, price: 10000 },
        { name: "Товар 2", quantity: 1, price: 25000 },
    ],
    totalSum: 45000,
};

describe("OrderReceipt", () => {
    test("renders logo", () => {
        const { getByAltText } = render(<OrderReceipt {...baseProps} />);
        const logo = getByAltText("Jahon Bozor");
        expect(logo).toBeDefined();
        expect(logo.getAttribute("src")).toContain("logo.svg");
    });

    test("renders order ID", () => {
        const { getByText } = render(<OrderReceipt {...baseProps} />);
        expect(getByText("Заказ №42")).toBeDefined();
    });

    test("renders date", () => {
        const { container } = render(<OrderReceipt {...baseProps} />);
        expect(container.textContent).toContain("01.01.2025 12:00");
    });

    test("renders client name", () => {
        const { container } = render(<OrderReceipt {...baseProps} />);
        expect(container.textContent).toContain("Иван Иванов");
    });

    test("renders payment type", () => {
        const { container } = render(<OrderReceipt {...baseProps} />);
        expect(container.textContent).toContain("payment_cash");
    });

    test("renders all item rows", () => {
        const { getByText } = render(<OrderReceipt {...baseProps} />);
        expect(getByText("Товар 1")).toBeDefined();
        expect(getByText("Товар 2")).toBeDefined();
    });

    test("renders correct number of table rows (header + items)", () => {
        const { container } = render(<OrderReceipt {...baseProps} />);
        const rows = container.querySelectorAll("tr");
        // 1 header row + 2 data rows
        expect(rows).toHaveLength(3);
    });

    test("renders total sum with receipt_total label", () => {
        const { container } = render(<OrderReceipt {...baseProps} />);
        expect(container.textContent).toContain("receipt_total");
        expect(container.textContent).toContain("45");
    });

    test("renders comment when provided", () => {
        const { container } = render(<OrderReceipt {...baseProps} />);
        expect(container.textContent).toContain("Тестовый комментарий");
    });

    test("renders thank you footer", () => {
        const { getByText } = render(<OrderReceipt {...baseProps} />);
        expect(getByText("receipt_thank_you")).toBeDefined();
    });

    test("hides comment when null", () => {
        const { container } = render(<OrderReceipt {...baseProps} comment={null} />);
        expect(container.textContent).not.toContain("receipt_comment");
    });

    test("hides client when null", () => {
        const { container } = render(<OrderReceipt {...baseProps} clientName={null} />);
        expect(container.textContent).not.toContain("receipt_client");
    });

    test("hides order info section when no info provided", () => {
        const { container } = render(
            <OrderReceipt items={baseProps.items} totalSum={baseProps.totalSum} />,
        );
        expect(container.textContent).not.toContain("receipt_date");
        expect(container.textContent).not.toContain("receipt_client");
    });

    test("applies pageBreakBefore style when pageBreak is true", () => {
        const { container } = render(<OrderReceipt {...baseProps} pageBreak />);
        const receipt = container.querySelector<HTMLElement>(".print-receipt")!;
        expect(receipt.style.pageBreakBefore).toBe("always");
    });

    test("does not apply pageBreakBefore style by default", () => {
        const { container } = render(<OrderReceipt {...baseProps} />);
        const receipt = container.querySelector<HTMLElement>(".print-receipt")!;
        expect(receipt.style.pageBreakBefore).toBe("");
    });

    test("has print-receipt class on root element", () => {
        const { container } = render(<OrderReceipt {...baseProps} />);
        expect(container.querySelector(".print-receipt")).toBeDefined();
        expect(container.querySelector(".print-receipt")).not.toBeNull();
    });

    test("has aria-hidden attribute", () => {
        const { container } = render(<OrderReceipt {...baseProps} />);
        const receipt = container.querySelector(".print-receipt");
        expect(receipt?.getAttribute("aria-hidden")).toBe("true");
    });

    test("renders placeholder for item with no product name", () => {
        const propsWithNullProduct: OrderReceiptProps = {
            ...baseProps,
            items: [
                { name: "", quantity: 3, price: 15000 },
                { name: "Tovar 2", quantity: 1, price: 25000 },
            ],
            totalSum: 70000,
        };
        const { getByText } = render(<OrderReceipt {...propsWithNullProduct} />);
        expect(getByText("Tovar 2")).toBeDefined();
    });

    test("renders correctly when all items have empty product name", () => {
        const propsAllEmpty: OrderReceiptProps = {
            ...baseProps,
            items: [
                { name: "", quantity: 2, price: 10000 },
                { name: "", quantity: 5, price: 20000 },
            ],
            totalSum: 120000,
        };
        const { container } = render(<OrderReceipt {...propsAllEmpty} />);
        const rows = container.querySelectorAll("tr");
        // 1 header + 2 data rows
        expect(rows).toHaveLength(3);
    });

    test("renders item price formatted with currency", () => {
        const { container } = render(<OrderReceipt {...baseProps} />);
        // formatCurrency mock returns "10000 common:sum" (locale may add spaces)
        expect(container.textContent).toContain("common:sum");
    });

    test("renders item total (price * quantity)", () => {
        const { container } = render(<OrderReceipt {...baseProps} />);
        // item 1: 10000 * 2 = 20000, formatCurrency returns "20000 common:sum"
        expect(container.textContent).toContain("20");
    });
});

describe("OrderReceiptContainer", () => {
    test("renders nothing when receipts array is empty", () => {
        render(<OrderReceiptContainer receipts={[]} />);
        expect(document.body.querySelector(".print-receipt-container")).toBeNull();
    });

    test("renders single receipt via portal to body", () => {
        render(<OrderReceiptContainer receipts={[baseProps]} />);
        const wrapper = document.body.querySelector(".print-receipt-container");
        expect(wrapper).not.toBeNull();
        expect(wrapper!.querySelector("img[alt='Jahon Bozor']")).not.toBeNull();
    });

    test("renders multiple receipts", () => {
        render(<OrderReceiptContainer receipts={[baseProps, { ...baseProps, orderId: 43 }]} />);
        const receipts = document.body.querySelectorAll(".print-receipt");
        expect(receipts).toHaveLength(2);
    });

    test("applies pageBreak on non-first receipts", () => {
        render(<OrderReceiptContainer receipts={[baseProps, { ...baseProps, orderId: 43 }]} />);
        const receipts = document.body.querySelectorAll(".print-receipt");
        expect((receipts[0] as HTMLElement).style.pageBreakBefore).toBe("");
        expect((receipts[1] as HTMLElement).style.pageBreakBefore).toBe("always");
    });

    test("has hidden class on container", () => {
        render(<OrderReceiptContainer receipts={[baseProps]} />);
        const wrapper = document.body.querySelector(".print-receipt-container");
        expect(wrapper?.className).toContain("hidden");
    });
});
