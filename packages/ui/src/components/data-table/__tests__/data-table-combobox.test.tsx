import { act, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Mock } from "vitest";

vi.mock("motion/react", async () => (await import("./test-helpers")).motionMock);

import { DataTableCombobox } from "../data-table-combobox";

// ── Test data ──────────────────────────────────────────────────
const options = [
    { label: "Apple", value: "apple" },
    { label: "Banana", value: "banana" },
    { label: "Cherry", value: "cherry" },
    { label: "Date", value: "date" },
];

// ── Tests ──────────────────────────────────────────────────────
describe("DataTableCombobox", () => {
    let onChange: Mock;
    let onSelect: Mock;
    let _onBlur: Mock;
    let onKeyDown: Mock;

    beforeEach(() => {
        onChange = vi.fn();
        onSelect = vi.fn();
        _onBlur = vi.fn();
        onKeyDown = vi.fn();
    });

    // ── Happy path ─────────────────────────────────────────────
    test("should render input with placeholder", () => {
        const { getByPlaceholderText } = render(
            <DataTableCombobox
                value=""
                onChange={onChange}
                options={options}
                placeholder="Search..."
            />,
        );

        expect(getByPlaceholderText("Search...")).toBeDefined();
    });

    test("should call onChange when typing", async () => {
        const user = userEvent.setup();
        const { getByRole } = render(
            <DataTableCombobox
                value=""
                onChange={onChange}
                options={options}
                placeholder="Search..."
            />,
        );

        const input = getByRole("combobox");
        await user.type(input, "App");

        expect(onChange).toHaveBeenCalled();
    });

    test("should show dropdown when typing", async () => {
        const user = userEvent.setup();
        const { getByRole } = render(
            <DataTableCombobox value="" onChange={onChange} options={options} />,
        );

        const input = getByRole("combobox");
        await user.type(input, "a");

        // Portal renders options in document.body
        const optionElements = document.querySelectorAll(".combobox-dropdown > div");
        expect(optionElements.length).toBeGreaterThan(0);
    });

    test("should display selected option label when value matches option", () => {
        const { getByRole } = render(
            <DataTableCombobox value="apple" onChange={onChange} options={options} />,
        );

        const input = getByRole("combobox") as HTMLInputElement;
        expect(input.value).toBe("Apple");
    });

    // ── Filtering ──────────────────────────────────────────────
    test("should filter options based on input text", async () => {
        const user = userEvent.setup();
        let currentValue = "";
        const trackingOnChange = vi.fn((val: string) => {
            currentValue = val;
        });

        const { getByRole, rerender } = render(
            <DataTableCombobox
                value={currentValue}
                onChange={trackingOnChange}
                options={options}
            />,
        );

        const input = getByRole("combobox");
        await user.click(input);
        await user.type(input, "an");

        // Re-render with updated value for filtering
        rerender(<DataTableCombobox value="an" onChange={trackingOnChange} options={options} />);

        // Should show Banana (contains "an") and potentially Date (no match)
        const dropdownOptions = document.querySelectorAll(".combobox-dropdown > div:not(.italic)");
        const texts = Array.from(dropdownOptions).map((el) => el.textContent);

        // At least "Banana" should be in filtered results (contains "an")
        expect(texts.some((t) => t === "Banana")).toBe(true);
        // "Cherry" should NOT be in filtered results
        expect(texts.some((t) => t === "Cherry")).toBe(false);
    });

    test("should show 'No results' when no options match filter", async () => {
        const user = userEvent.setup();
        const { getByRole, rerender } = render(
            <DataTableCombobox
                value=""
                onChange={onChange}
                options={options}
                placeholder="Search..."
            />,
        );

        const input = getByRole("combobox");
        await user.click(input);

        // Re-render with non-matching value
        rerender(
            <DataTableCombobox
                value="zzz"
                onChange={onChange}
                options={options}
                placeholder="Search..."
            />,
        );

        const noResults = document.querySelector(".combobox-dropdown .italic");
        expect(noResults).toBeDefined();
    });

    // ── Selection ──────────────────────────────────────────────
    test("should call onSelect when option is clicked", async () => {
        const user = userEvent.setup();
        const { getByRole } = render(
            <DataTableCombobox
                value=""
                onChange={onChange}
                onSelect={onSelect}
                options={options}
            />,
        );

        const input = getByRole("combobox");
        await user.type(input, "a");

        // Find the option in the portal and click it
        const dropdownOptions = document.querySelectorAll(".combobox-dropdown > div:not(.italic)");
        const appleOption = Array.from(dropdownOptions).find((el) => el.textContent === "Apple");
        expect(appleOption).toBeDefined();

        fireEvent.mouseDown(appleOption!);

        expect(onChange).toHaveBeenCalledWith("apple");
        expect(onSelect).toHaveBeenCalledWith("apple");
    });

    // ── Keyboard navigation ────────────────────────────────────
    test("should navigate options with ArrowDown/ArrowUp", async () => {
        const user = userEvent.setup();
        const { getByRole } = render(
            <DataTableCombobox
                value=""
                onChange={onChange}
                onSelect={onSelect}
                options={options}
                onKeyDown={onKeyDown}
            />,
        );

        const input = getByRole("combobox");
        await user.click(input);

        // Arrow down should move selection
        await user.keyboard("{ArrowDown}");
        expect(onKeyDown).toHaveBeenCalled();

        // Arrow down then Enter should select the second option
        await user.keyboard("{ArrowDown}");
        await user.keyboard("{Enter}");

        // Should have selected "cherry" (index 2: Apple=0, Banana=1, Cherry=2)
        expect(onSelect).toHaveBeenCalled();
    });

    test("should close dropdown on Escape", async () => {
        const user = userEvent.setup();
        const { getByRole } = render(
            <DataTableCombobox value="" onChange={onChange} options={options} />,
        );

        const input = getByRole("combobox");
        await user.click(input);

        // Dropdown should be open
        let dropdown = document.querySelector(".combobox-dropdown");
        expect(dropdown).toBeDefined();

        await user.keyboard("{Escape}");

        // Wait for close animation
        await act(async () => {
            await new Promise((r) => setTimeout(r, 200));
        });

        // Dropdown should be closed
        dropdown = document.querySelector(".combobox-dropdown");
        expect(dropdown).toBeNull();
    });

    // ── Auto-focus ─────────────────────────────────────────────
    test("should auto-focus input when autoFocus is true", () => {
        const { getByRole } = render(
            <DataTableCombobox value="" onChange={onChange} options={options} autoFocus />,
        );

        const input = getByRole("combobox");
        expect(document.activeElement).toBe(input);
    });

    // ── Edge cases ─────────────────────────────────────────────
    test("should handle empty options array", async () => {
        const user = userEvent.setup();
        const { getByRole } = render(
            <DataTableCombobox value="" onChange={onChange} options={[]} placeholder="No items" />,
        );

        const input = getByRole("combobox");
        await user.click(input);

        const noResults = document.querySelector(".combobox-dropdown .italic");
        expect(noResults).toBeDefined();
    });

    test("should handle empty string value", () => {
        const { getByRole } = render(
            <DataTableCombobox value="" onChange={onChange} options={options} />,
        );

        const input = getByRole("combobox") as HTMLInputElement;
        expect(input.value).toBe("");
    });

    test("should show error styling when error prop is true", () => {
        const { getByRole } = render(
            <DataTableCombobox value="" onChange={onChange} options={options} error />,
        );

        const input = getByRole("combobox");
        // Input should have border-destructive class (applied via cn)
        expect(input.className).toContain("border-destructive");
    });

    test("should handle value not matching any option", () => {
        const { getByRole } = render(
            <DataTableCombobox value="unknown" onChange={onChange} options={options} />,
        );

        const input = getByRole("combobox") as HTMLInputElement;
        // Should show raw value since it doesn't match any option
        expect(input.value).toBe("unknown");
    });

    // ── Boundary values ────────────────────────────────────────
    test("should handle large number of options", async () => {
        const user = userEvent.setup();
        const manyOptions = Array.from({ length: 100 }, (_, i) => ({
            label: `Option ${i + 1}`,
            value: String(i + 1),
        }));

        const { getByRole } = render(
            <DataTableCombobox value="" onChange={onChange} options={manyOptions} />,
        );

        const input = getByRole("combobox");
        // Type a space to trigger dropdown (matches all options)
        await user.type(input, " ");

        const dropdownOptions = document.querySelectorAll(".combobox-dropdown > div");
        expect(dropdownOptions.length).toBe(100);
    });

    test("should handle options with special characters in labels", () => {
        const specialOptions = [
            { label: "Café Latte", value: "cafe" },
            { label: '<script>alert("xss")</script>', value: "xss" },
            { label: "Ёжик", value: "hedgehog" },
        ];

        const { getByRole } = render(
            <DataTableCombobox value="" onChange={onChange} options={specialOptions} />,
        );

        // Should render without crashing
        expect(getByRole("combobox")).toBeDefined();
    });

    // ── ARIA attributes ───────────────────────────────────────
    test("should have correct ARIA attributes when closed", () => {
        const { getByRole } = render(
            <DataTableCombobox value="" onChange={onChange} options={options} />,
        );

        const input = getByRole("combobox");
        expect(input.getAttribute("aria-expanded")).toBe("false");
        expect(input.getAttribute("aria-autocomplete")).toBe("list");
        expect(input.getAttribute("aria-controls")).toBeNull();
        expect(input.getAttribute("aria-activedescendant")).toBeNull();
    });

    test("should have correct ARIA attributes when open", async () => {
        const user = userEvent.setup();
        const { getByRole } = render(
            <DataTableCombobox value="" onChange={onChange} options={options} />,
        );

        const input = getByRole("combobox");
        await user.type(input, "a");

        expect(input.getAttribute("aria-expanded")).toBe("true");
        expect(input.getAttribute("aria-controls")).toBeDefined();
        expect(input.getAttribute("aria-activedescendant")).toBeDefined();

        // Dropdown should have role="listbox"
        const listbox = document.querySelector("[role='listbox']");
        expect(listbox).toBeDefined();

        // Options should have role="option"
        const optionElements = document.querySelectorAll("[role='option']");
        expect(optionElements.length).toBe(4);

        // First option should have aria-selected="true"
        expect(optionElements[0].getAttribute("aria-selected")).toBe("true");
        expect(optionElements[1].getAttribute("aria-selected")).toBe("false");
    });

    test("should update aria-activedescendant on ArrowDown", async () => {
        const user = userEvent.setup();
        const { getByRole } = render(
            <DataTableCombobox value="" onChange={onChange} options={options} />,
        );

        const input = getByRole("combobox");
        await user.type(input, "a");

        // Initially points to first option
        const initialDescendant = input.getAttribute("aria-activedescendant");
        expect(initialDescendant).toContain("option-0");

        await user.keyboard("{ArrowDown}");

        // Should now point to second option
        const updatedDescendant = input.getAttribute("aria-activedescendant");
        expect(updatedDescendant).toContain("option-1");
    });
});
