import { describe, test, expect, mock } from "bun:test";
import { render } from "@testing-library/react";

mock.module("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            if (params) return `${key}_${JSON.stringify(params)}`;
            return key;
        },
    }),
}));

mock.module("@tanstack/react-router", () => ({
    Link: ({ children, to, params, ...props }: any) => (
        <a href={`${to}/${params?.orderId || ""}`} {...props}>
            {children}
        </a>
    ),
}));

mock.module("@jahonbozor/ui", () => ({
    Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>,
}));

import { OrderCard } from "../order-card";

describe("OrderCard", () => {
    const defaultProps = {
        id: 42,
        status: "NEW",
        paymentType: "CASH",
        createdAt: "2025-01-15T10:30:00.000Z",
        items: [
            { id: 1, quantity: 2, price: 5000, product: { name: "Item A" } },
            { id: 2, quantity: 1, price: 3000, product: { name: "Item B" } },
        ],
    };

    test("should render order number", () => {
        const { getByText } = render(<OrderCard {...defaultProps} />);
        expect(getByText(/order_number/)).toBeDefined();
    });

    test("should render formatted date", () => {
        const { getByText } = render(<OrderCard {...defaultProps} />);
        expect(getByText(/2025/)).toBeDefined();
    });

    test("should render status badge for NEW order", () => {
        const { getByText } = render(<OrderCard {...defaultProps} />);
        expect(getByText("status_new")).toBeDefined();
    });

    test("should render status badge for ACCEPTED order", () => {
        const { getByText } = render(<OrderCard {...{ ...defaultProps, status: "ACCEPTED" }} />);
        expect(getByText("status_accepted")).toBeDefined();
    });

    test("should render payment method", () => {
        const { getByText } = render(<OrderCard {...defaultProps} />);
        expect(getByText(/payment_cash/)).toBeDefined();
    });

    test("should render credit card payment method", () => {
        const { getByText } = render(<OrderCard {...{ ...defaultProps, paymentType: "CREDIT_CARD" }} />);
        expect(getByText(/payment_card/)).toBeDefined();
    });

    test("should calculate and render total price", () => {
        const { getByText } = render(<OrderCard {...defaultProps} />);
        expect(getByText(/13\s*000/)).toBeDefined();
    });

    test("should render as a link to order detail", () => {
        const { getByRole } = render(<OrderCard {...defaultProps} />);
        const link = getByRole("link");
        expect(link.getAttribute("href")).toContain("42");
    });

    test("should handle Date object for createdAt", () => {
        const { getByText } = render(<OrderCard {...{ ...defaultProps, createdAt: new Date("2025-01-15T10:30:00.000Z") }} />);
        expect(getByText(/2025/)).toBeDefined();
    });
});
