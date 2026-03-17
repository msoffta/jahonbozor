import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock("motion/react", async () => {
    const { motionReactMock } = await import("@/test-utils/ui-mocks");
    return motionReactMock();
});
vi.mock("@jahonbozor/ui", async () => {
    const { jahonbozorUIMock } = await import("@/test-utils/ui-mocks");
    return jahonbozorUIMock();
});

import { OrderStatusBadge, getPaymentTypeLabel } from "../order-status-badge";

describe("OrderStatusBadge", () => {
    test("should render status_new for NEW status", () => {
        const { getByText } = render(<OrderStatusBadge status="NEW" />);
        expect(getByText("status_new")).toBeDefined();
    });

    test("should render status_cancelled for CANCELLED status", () => {
        const { getByText } = render(<OrderStatusBadge status="CANCELLED" />);
        expect(getByText("status_cancelled")).toBeDefined();
    });

    test("should render status_accepted for ACCEPTED status", () => {
        const { getByText } = render(<OrderStatusBadge status="ACCEPTED" />);
        expect(getByText("status_accepted")).toBeDefined();
    });

    test("should render status_accepted for unknown status", () => {
        const { getByText } = render(<OrderStatusBadge status="UNKNOWN" />);
        expect(getByText("status_accepted")).toBeDefined();
    });
});

describe("getPaymentTypeLabel", () => {
    const t = (key: string) => key;

    test("should return payment_card for CREDIT_CARD", () => {
        expect(getPaymentTypeLabel("CREDIT_CARD", t)).toBe("payment_card");
    });

    test("should return payment_cash for CASH", () => {
        expect(getPaymentTypeLabel("CASH", t)).toBe("payment_cash");
    });

    test("should return payment_debt for DEBT", () => {
        expect(getPaymentTypeLabel("DEBT", t)).toBe("payment_debt");
    });

    test("should return payment_cash for unknown payment type", () => {
        expect(getPaymentTypeLabel("UNKNOWN", t)).toBe("payment_cash");
    });
});
