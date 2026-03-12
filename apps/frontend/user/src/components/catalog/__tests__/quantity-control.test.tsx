import { describe, test, expect, mock } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import { setupUIMocks } from "../../../test-utils/ui-mocks";

// Setup centralized UI mocks
setupUIMocks();

import { QuantityControl } from "../quantity-control";

describe("QuantityControl", () => {
    test("should render the current quantity", () => {
        const { getByText } = render(
            <QuantityControl quantity={5} onIncrement={() => {}} onDecrement={() => {}} />,
        );
        expect(getByText("5")).toBeDefined();
    });

    test("should call onIncrement when plus button is clicked", () => {
        const onIncrement = mock();
        const { getAllByRole } = render(
            <QuantityControl quantity={1} onIncrement={onIncrement} onDecrement={() => {}} />,
        );

        const buttons = getAllByRole("button");
        // Plus is the second button
        fireEvent.click(buttons[1]);
        expect(onIncrement).toHaveBeenCalledTimes(1);
    });

    test("should call onDecrement when minus button is clicked", () => {
        const onDecrement = mock();
        const { getAllByRole } = render(
            <QuantityControl quantity={3} onIncrement={() => {}} onDecrement={onDecrement} />,
        );

        const buttons = getAllByRole("button");
        // Minus is the first button
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

        rerender(
            <QuantityControl quantity={99} onIncrement={() => {}} onDecrement={() => {}} />,
        );
        expect(getByText("99")).toBeDefined();
    });
});
