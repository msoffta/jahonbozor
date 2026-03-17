import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { format } from "date-fns";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../popover", () => ({
    Popover: ({ children, open, onOpenChange }: any) => (
        <div data-testid="popover" data-open={open}>
            {children}
            {/* Expose onOpenChange so tests can simulate popover close */}
            <button data-testid="popover-close" onClick={() => onOpenChange?.(false)} />
        </div>
    ),
    PopoverAnchor: ({ children }: any) => <>{children}</>,
    PopoverTrigger: ({ children }: any) => <>{children}</>,
    PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
}));

vi.mock("../calendar", () => ({
    Calendar: ({ onSelect, selected }: any) => (
        <div data-testid="calendar">
            <button data-testid="calendar-select" onClick={() => onSelect(new Date(2024, 2, 15))}>
                Select March 15
            </button>
            <button data-testid="calendar-clear" onClick={() => onSelect(undefined)}>
                Clear
            </button>
            {selected && <span data-testid="calendar-selected">{selected.toISOString()}</span>}
        </div>
    ),
}));

vi.mock("../button", () => ({
    Button: ({ children, onClick, ...props }: any) => (
        <button onClick={onClick} {...props}>
            {children}
        </button>
    ),
}));

import { DatePicker } from "../date-picker";

// ── Helpers ──────────────────────────────────────────────────────

/** Simulate typing by firing a change event with a value containing all digits at once. */
function changeInput(input: HTMLInputElement, value: string) {
    fireEvent.change(input, { target: { value } });
}

/** Get the main date input (the first textbox, which is always the date input). */
function getInput() {
    return screen.getByPlaceholderText(/dd\.MM\.yyyy/) as HTMLInputElement;
}

// ── Tests ────────────────────────────────────────────────────────

describe("DatePicker", () => {
    // ── Rendering ────────────────────────────────────────────────

    describe("rendering", () => {
        test("renders with empty value and shows default placeholder dd.MM.yyyy", () => {
            render(<DatePicker onChange={vi.fn()} />);
            const input = getInput();
            expect(input.placeholder).toBe("dd.MM.yyyy");
            expect(input.value).toBe("");
        });

        test("renders with Date value formatted as dd.MM.yyyy", () => {
            const date = new Date(2024, 2, 15); // March 15, 2024
            render(<DatePicker value={date} onChange={vi.fn()} />);
            expect(getInput().value).toBe("15.03.2024");
        });

        test("renders with ISO string value", () => {
            render(<DatePicker value="2024-06-01T10:30:00.000Z" onChange={vi.fn()} />);
            const input = getInput();
            // date-fns parses ISO string and formats to dd.MM.yyyy
            expect(input.value).toBe(format(new Date("2024-06-01T10:30:00.000Z"), "dd.MM.yyyy"));
        });

        test("renders with custom placeholder", () => {
            render(<DatePicker onChange={vi.fn()} placeholder="Pick a date" />);
            const input = screen.getByPlaceholderText("Pick a date") as HTMLInputElement;
            expect(input.placeholder).toBe("Pick a date");
        });

        test("applies custom className to input", () => {
            render(<DatePicker onChange={vi.fn()} className="my-custom-class" />);
            const input = getInput();
            expect(input.className).toContain("my-custom-class");
            // Also contains the default pr-8
            expect(input.className).toContain("pr-8");
        });

        test("renders disabled state", () => {
            render(<DatePicker onChange={vi.fn()} disabled />);
            expect(getInput().disabled).toBe(true);
        });

        test("renders calendar icon trigger button with tabIndex -1", () => {
            render(<DatePicker onChange={vi.fn()} />);
            const buttons = screen.getAllByRole("button");
            const iconButton = buttons.find((b) => b.tabIndex === -1);
            expect(iconButton).toBeDefined();
            expect(iconButton!.getAttribute("type")).toBe("button");
        });
    });

    // ── showTime mode ────────────────────────────────────────────

    describe("showTime mode", () => {
        test("shows dd.MM.yyyy HH:mm placeholder when showTime is true", () => {
            render(<DatePicker onChange={vi.fn()} showTime />);
            const input = getInput();
            expect(input.placeholder).toBe("dd.MM.yyyy HH:mm");
        });

        test("formats value with time when showTime is true", () => {
            const date = new Date(2024, 2, 15, 14, 30);
            render(<DatePicker value={date} onChange={vi.fn()} showTime />);
            expect(getInput().value).toBe("15.03.2024 14:30");
        });

        test("renders OK button when showTime is true and value is provided", () => {
            const date = new Date(2024, 2, 15, 14, 30);
            render(<DatePicker value={date} onChange={vi.fn()} showTime />);
            expect(screen.getByText("OK")).toBeDefined();
        });

        test("auto-formats time digits in showTime mode", () => {
            render(<DatePicker onChange={vi.fn()} showTime />);
            const input = getInput();
            // Type all digits: 150320241430 -> 15.03.2024 14:30
            changeInput(input, "150320241430");
            expect(input.value).toBe("15.03.2024 14:30");
        });

        test("auto-formats partial time digits (hours only) in showTime mode", () => {
            render(<DatePicker onChange={vi.fn()} showTime />);
            const input = getInput();
            // Just hours without minutes
            changeInput(input, "1503202414");
            expect(input.value).toBe("15.03.2024 14");
        });
    });

    // ── Auto-formatting mask ─────────────────────────────────────

    describe("auto-formatting mask", () => {
        test("formats 12032024 as 12.03.2024", () => {
            render(<DatePicker onChange={vi.fn()} />);
            const input = getInput();
            changeInput(input, "12032024");
            expect(input.value).toBe("12.03.2024");
        });

        test("formats partial input 120 as 12.0", () => {
            render(<DatePicker onChange={vi.fn()} />);
            const input = getInput();
            changeInput(input, "120");
            expect(input.value).toBe("12.0");
        });

        test("formats 2-digit input as just day", () => {
            render(<DatePicker onChange={vi.fn()} />);
            const input = getInput();
            changeInput(input, "15");
            expect(input.value).toBe("15");
        });

        test("formats 4-digit input as DD.MM", () => {
            render(<DatePicker onChange={vi.fn()} />);
            const input = getInput();
            changeInput(input, "1503");
            expect(input.value).toBe("15.03");
        });

        test("formats 6-digit input as DD.MM.YY", () => {
            render(<DatePicker onChange={vi.fn()} />);
            const input = getInput();
            changeInput(input, "150320");
            expect(input.value).toBe("15.03.20");
        });

        test("truncates extra digits beyond dd.MM.yyyy in non-showTime mode", () => {
            render(<DatePicker onChange={vi.fn()} />);
            const input = getInput();
            // 10 digits, but non-showTime stops at 8 date digits
            changeInput(input, "1503202499");
            // digits.slice(4,8) takes "2024", the "99" is not used in non-showTime
            expect(input.value).toBe("15.03.2024");
        });

        test("strips non-digit characters and reformats", () => {
            render(<DatePicker onChange={vi.fn()} />);
            const input = getInput();
            // User pastes something with dots already
            changeInput(input, "15.03.2024");
            // Digits extracted: 15032024 -> reformatted 15.03.2024
            expect(input.value).toBe("15.03.2024");
        });

        test("single digit input stays as-is", () => {
            render(<DatePicker onChange={vi.fn()} />);
            const input = getInput();
            changeInput(input, "1");
            expect(input.value).toBe("1");
        });
    });

    // ── onChange behavior ─────────────────────────────────────────

    describe("onChange", () => {
        test("calls onChange with Date when valid date is typed", () => {
            const onChange = vi.fn();
            render(<DatePicker onChange={onChange} />);
            const input = getInput();
            changeInput(input, "15032024");
            expect(onChange).toHaveBeenCalledWith(expect.any(Date));
            const calledDate: Date = onChange.mock.calls[0][0];
            expect(calledDate.getFullYear()).toBe(2024);
            expect(calledDate.getMonth()).toBe(2); // March = 2
            expect(calledDate.getDate()).toBe(15);
        });

        test("does not call onChange for incomplete date input", () => {
            const onChange = vi.fn();
            render(<DatePicker onChange={onChange} />);
            const input = getInput();
            // Partial date -- not parseable as dd.MM.yyyy strict
            changeInput(input, "1503");
            expect(onChange).not.toHaveBeenCalled();
        });

        test("calls onChange(undefined) when input is cleared", () => {
            const onChange = vi.fn();
            render(<DatePicker value={new Date(2024, 2, 15)} onChange={onChange} />);
            const input = getInput();
            changeInput(input, "");
            expect(onChange).toHaveBeenCalledWith(undefined);
        });

        test("calls onChange with Date when calendar date is selected", () => {
            const onChange = vi.fn();
            render(<DatePicker onChange={onChange} />);
            const selectBtn = screen.getByTestId("calendar-select");
            fireEvent.click(selectBtn);
            expect(onChange).toHaveBeenCalledWith(expect.any(Date));
            const calledDate: Date = onChange.mock.calls[0][0];
            expect(calledDate.getMonth()).toBe(2); // March
            expect(calledDate.getDate()).toBe(15);
        });

        test("calls onChange(undefined) when calendar selection is cleared", () => {
            const onChange = vi.fn();
            render(<DatePicker value={new Date(2024, 2, 15)} onChange={onChange} />);
            const clearBtn = screen.getByTestId("calendar-clear");
            fireEvent.click(clearBtn);
            expect(onChange).toHaveBeenCalledWith(undefined);
        });
    });

    // ── Keyboard navigation ──────────────────────────────────────

    describe("keyboard navigation", () => {
        test("ArrowUp increments day by 1", () => {
            const onChange = vi.fn();
            const date = new Date(2024, 2, 15); // March 15
            render(<DatePicker value={date} onChange={onChange} />);
            const input = getInput();
            fireEvent.keyDown(input, { key: "ArrowUp" });
            expect(onChange).toHaveBeenCalledWith(expect.any(Date));
            const newDate: Date = onChange.mock.calls[0][0];
            expect(newDate.getDate()).toBe(16);
            expect(newDate.getMonth()).toBe(2);
        });

        test("ArrowDown decrements day by 1", () => {
            const onChange = vi.fn();
            const date = new Date(2024, 2, 15); // March 15
            render(<DatePicker value={date} onChange={onChange} />);
            const input = getInput();
            fireEvent.keyDown(input, { key: "ArrowDown" });
            expect(onChange).toHaveBeenCalledWith(expect.any(Date));
            const newDate: Date = onChange.mock.calls[0][0];
            expect(newDate.getDate()).toBe(14);
            expect(newDate.getMonth()).toBe(2);
        });

        test("ArrowUp wraps month correctly (March 1 -> March 2)", () => {
            const onChange = vi.fn();
            const date = new Date(2024, 2, 1); // March 1
            render(<DatePicker value={date} onChange={onChange} />);
            fireEvent.keyDown(getInput(), { key: "ArrowUp" });
            const newDate: Date = onChange.mock.calls[0][0];
            expect(newDate.getDate()).toBe(2);
        });

        test("ArrowDown wraps to previous month (March 1 -> Feb 29)", () => {
            const onChange = vi.fn();
            const date = new Date(2024, 2, 1); // March 1, 2024 (leap year)
            render(<DatePicker value={date} onChange={onChange} />);
            fireEvent.keyDown(getInput(), { key: "ArrowDown" });
            const newDate: Date = onChange.mock.calls[0][0];
            expect(newDate.getDate()).toBe(29);
            expect(newDate.getMonth()).toBe(1); // February
        });

        test("ArrowUp uses current date when no value is provided", () => {
            const onChange = vi.fn();
            render(<DatePicker onChange={onChange} />);
            fireEvent.keyDown(getInput(), { key: "ArrowUp" });
            // Should call onChange with tomorrow's date (based on current date)
            expect(onChange).toHaveBeenCalledWith(expect.any(Date));
        });

        test("Escape key calls onKeyDown callback", () => {
            const onKeyDown = vi.fn();
            render(<DatePicker onChange={vi.fn()} onKeyDown={onKeyDown} />);
            fireEvent.keyDown(getInput(), { key: "Escape" });
            expect(onKeyDown).toHaveBeenCalledTimes(1);
            expect(onKeyDown.mock.calls[0][0].key).toBe("Escape");
        });

        test("Enter key calls onKeyDown callback", () => {
            const onKeyDown = vi.fn();
            render(<DatePicker onChange={vi.fn()} onKeyDown={onKeyDown} />);
            fireEvent.keyDown(getInput(), { key: "Enter" });
            expect(onKeyDown).toHaveBeenCalledTimes(1);
            expect(onKeyDown.mock.calls[0][0].key).toBe("Enter");
        });

        test("regular key presses forward to onKeyDown", () => {
            const onKeyDown = vi.fn();
            render(<DatePicker onChange={vi.fn()} onKeyDown={onKeyDown} />);
            fireEvent.keyDown(getInput(), { key: "a" });
            expect(onKeyDown).toHaveBeenCalledTimes(1);
        });
    });

    // ── inputRef callback ────────────────────────────────────────

    describe("inputRef", () => {
        test("inputRef callback receives the input element", () => {
            const inputRef = vi.fn();
            render(<DatePicker onChange={vi.fn()} inputRef={inputRef} />);
            expect(inputRef).toHaveBeenCalledWith(expect.any(HTMLInputElement));
        });

        test("inputRef callback receives null on unmount", () => {
            const inputRef = vi.fn();
            const { unmount } = render(<DatePicker onChange={vi.fn()} inputRef={inputRef} />);
            inputRef.mockClear();
            unmount();
            expect(inputRef).toHaveBeenCalledWith(null);
        });
    });

    // ── Focus / Blur / Open state ────────────────────────────────

    describe("focus and blur behavior", () => {
        test("opens popover on focus", () => {
            render(<DatePicker onChange={vi.fn()} />);
            const input = getInput();
            fireEvent.focus(input);
            const popover = screen.getByTestId("popover");
            expect(popover.getAttribute("data-open")).toBe("true");
        });

        test("onBlur resyncs input text from value", () => {
            const date = new Date(2024, 2, 15);
            render(<DatePicker value={date} onChange={vi.fn()} />);
            const input = getInput();
            // Simulate user typing invalid partial text
            changeInput(input, "99");
            expect(input.value).toBe("99");
            // On blur, the component resyncs from the value prop
            fireEvent.blur(input);
            expect(input.value).toBe("15.03.2024");
        });

        test("onBlur clears input text when value is undefined", () => {
            render(<DatePicker onChange={vi.fn()} />);
            const input = getInput();
            changeInput(input, "99");
            expect(input.value).toBe("99");
            fireEvent.blur(input);
            expect(input.value).toBe("");
        });
    });

    // ── Popover close behavior ───────────────────────────────────

    describe("popover close (onOpenChange false)", () => {
        test("resyncs input text from value when popover closes", () => {
            const date = new Date(2024, 2, 15);
            render(<DatePicker value={date} onChange={vi.fn()} />);
            const input = getInput();
            // Type invalid partial text
            changeInput(input, "abc");
            // Simulate popover close via the mock's close button
            const closeBtn = screen.getByTestId("popover-close");
            fireEvent.click(closeBtn);
            // Input should resync to the formatted value
            expect(input.value).toBe("15.03.2024");
        });

        test("calls onClose callback when popover closes", () => {
            const onClose = vi.fn();
            render(<DatePicker onChange={vi.fn()} onClose={onClose} />);
            const closeBtn = screen.getByTestId("popover-close");
            fireEvent.click(closeBtn);
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        test("clears input when popover closes with no value", () => {
            render(<DatePicker onChange={vi.fn()} />);
            const input = getInput();
            changeInput(input, "123");
            const closeBtn = screen.getByTestId("popover-close");
            fireEvent.click(closeBtn);
            expect(input.value).toBe("");
        });
    });

    // ── External value sync ──────────────────────────────────────

    describe("external value sync", () => {
        test("syncs inputText when value changes externally", () => {
            const { rerender } = render(
                <DatePicker value={new Date(2024, 2, 15)} onChange={vi.fn()} />,
            );
            expect(getInput().value).toBe("15.03.2024");
            rerender(<DatePicker value={new Date(2024, 5, 1)} onChange={vi.fn()} />);
            expect(getInput().value).toBe("01.06.2024");
        });

        test("clears inputText when value changes to undefined", () => {
            const { rerender } = render(
                <DatePicker value={new Date(2024, 2, 15)} onChange={vi.fn()} />,
            );
            expect(getInput().value).toBe("15.03.2024");
            rerender(<DatePicker value={undefined} onChange={vi.fn()} />);
            expect(getInput().value).toBe("");
        });

        test("syncs inputText when value changes in showTime mode", () => {
            const { rerender } = render(
                <DatePicker value={new Date(2024, 2, 15, 10, 30)} onChange={vi.fn()} showTime />,
            );
            expect(getInput().value).toBe("15.03.2024 10:30");
            rerender(
                <DatePicker value={new Date(2024, 5, 1, 18, 0)} onChange={vi.fn()} showTime />,
            );
            expect(getInput().value).toBe("01.06.2024 18:00");
        });
    });

    // ── Calendar selection in showTime mode ──────────────────────

    describe("calendar selection with showTime", () => {
        test("preserves existing time when selecting new date in showTime mode", () => {
            const onChange = vi.fn();
            const date = new Date(2024, 2, 10, 14, 30); // March 10, 14:30
            render(<DatePicker value={date} onChange={onChange} showTime />);
            // Select March 15 via calendar mock
            fireEvent.click(screen.getByTestId("calendar-select"));
            expect(onChange).toHaveBeenCalledWith(expect.any(Date));
            const newDate: Date = onChange.mock.calls[0][0];
            expect(newDate.getDate()).toBe(15);
            expect(newDate.getHours()).toBe(14);
            expect(newDate.getMinutes()).toBe(30);
        });

        test("does not auto-close popover when selecting date in showTime mode", () => {
            const onChange = vi.fn();
            const date = new Date(2024, 2, 10, 14, 30);
            render(<DatePicker value={date} onChange={onChange} showTime />);
            // First, open the popover by focusing the input
            fireEvent.focus(getInput());
            expect(screen.getByTestId("popover").getAttribute("data-open")).toBe("true");
            // Select a date -- in showTime mode, popover should NOT close
            fireEvent.click(screen.getByTestId("calendar-select"));
            expect(screen.getByTestId("popover").getAttribute("data-open")).toBe("true");
        });
    });

    // ── Edge cases ───────────────────────────────────────────────

    describe("edge cases", () => {
        test("handles empty string value", () => {
            render(<DatePicker value="" onChange={vi.fn()} />);
            // new Date("") is invalid, so inputText should be ""
            expect(getInput().value).toBe("");
        });

        test("handles invalid string value gracefully", () => {
            render(<DatePicker value="not-a-date" onChange={vi.fn()} />);
            // new Date("not-a-date") is invalid, so inputText stays ""
            expect(getInput().value).toBe("");
        });

        test("does not call onChange for invalid date like 99.99.9999", () => {
            const onChange = vi.fn();
            render(<DatePicker onChange={onChange} />);
            changeInput(getInput(), "99999999");
            // parse("99.99.9999", "dd.MM.yyyy") is invalid
            expect(onChange).not.toHaveBeenCalled();
        });

        test("disabled icon button when disabled prop is true", () => {
            render(<DatePicker onChange={vi.fn()} disabled />);
            const buttons = screen.getAllByRole("button");
            const iconButton = buttons.find((b) => b.tabIndex === -1) as HTMLButtonElement | undefined;
            expect(iconButton?.disabled).toBe(true);
        });
    });
});
