import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock("lucide-react", () => ({
    AlertTriangle: (props: any) => <svg data-testid="alert-triangle" {...props} />,
}));

vi.mock("@jahonbozor/ui", async () => {
    const { jahonbozorUIMock } = await import("@/test-utils/ui-mocks");
    return jahonbozorUIMock();
});

import { ConfirmDrawer } from "../confirm-drawer";

describe("ConfirmDrawer", () => {
    const defaultProps = {
        open: true,
        onOpenChange: vi.fn(),
        onConfirm: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("should render with default title and description", () => {
        render(<ConfirmDrawer {...defaultProps} />);

        expect(screen.getByText("confirm_cancel")).toBeDefined();
        expect(screen.getByText("confirm_cancel_description")).toBeDefined();
    });

    test("should render custom title and description", () => {
        render(
            <ConfirmDrawer
                {...defaultProps}
                title="Custom Title"
                description="Custom description text"
            />,
        );

        expect(screen.getByText("Custom Title")).toBeDefined();
        expect(screen.getByText("Custom description text")).toBeDefined();
    });

    test("should call onConfirm and close when confirm button is clicked", async () => {
        const user = userEvent.setup();
        render(<ConfirmDrawer {...defaultProps} />);

        const confirmButton = screen.getByText("cancel_order");
        await user.click(confirmButton);

        expect(defaultProps.onConfirm).toHaveBeenCalledOnce();
        expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });

    test("should close without confirming when cancel button is clicked", async () => {
        const user = userEvent.setup();
        render(<ConfirmDrawer {...defaultProps} />);

        const cancelButton = screen.getByText("cancel");
        await user.click(cancelButton);

        expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
        expect(defaultProps.onConfirm).not.toHaveBeenCalled();
    });

    test("should render custom confirm label", () => {
        render(<ConfirmDrawer {...defaultProps} confirmLabel="Delete it" />);

        expect(screen.getByText("Delete it")).toBeDefined();
    });

    test("should disable buttons when isLoading is true", () => {
        render(<ConfirmDrawer {...defaultProps} isLoading />);

        const buttons = screen.getAllByRole("button");
        buttons.forEach((button) => {
            expect((button as HTMLButtonElement).disabled).toBe(true);
        });
    });

    test("should not render when open is false", () => {
        render(<ConfirmDrawer {...defaultProps} open={false} />);

        expect(screen.queryByText("confirm_cancel")).toBeNull();
    });
});
