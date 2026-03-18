import { fireEvent, render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("motion/react", async () => {
    const { motionReactMock } = await import("@/test-utils/ui-mocks");
    return motionReactMock();
});
vi.mock("@jahonbozor/ui", async () => {
    const { jahonbozorUIMock } = await import("@/test-utils/ui-mocks");
    return jahonbozorUIMock();
});

import { QuantityControl } from "../quantity-control";

describe("QuantityControl", () => {
    test("should render the current quantity", () => {
        const { getByText } = render(
            <QuantityControl quantity={5} onIncrement={() => {}} onDecrement={() => {}} />,
        );
        expect(getByText("5")).toBeDefined();
    });

    test("should call onIncrement when plus button is clicked", () => {
        const onIncrement = vi.fn();
        const { getAllByRole } = render(
            <QuantityControl quantity={1} onIncrement={onIncrement} onDecrement={() => {}} />,
        );

        const buttons = getAllByRole("button");
        fireEvent.click(buttons[1]);
        expect(onIncrement).toHaveBeenCalledTimes(1);
    });

    test("should call onDecrement when minus button is clicked", () => {
        const onDecrement = vi.fn();
        const { getAllByRole } = render(
            <QuantityControl quantity={3} onIncrement={() => {}} onDecrement={onDecrement} />,
        );

        const buttons = getAllByRole("button");
        fireEvent.click(buttons[0]);
        expect(onDecrement).toHaveBeenCalledTimes(1);
    });

    test("should render exactly two buttons (minus and plus)", () => {
        const { getAllByRole } = render(
            <QuantityControl quantity={1} onIncrement={() => {}} onDecrement={() => {}} />,
        );
        expect(getAllByRole("button").length).toBe(2);
    });

    test("should display different quantities correctly", () => {
        const { getByText, rerender } = render(
            <QuantityControl quantity={1} onIncrement={() => {}} onDecrement={() => {}} />,
        );
        expect(getByText("1")).toBeDefined();

        rerender(<QuantityControl quantity={99} onIncrement={() => {}} onDecrement={() => {}} />);
        expect(getByText("99")).toBeDefined();
    });
});
