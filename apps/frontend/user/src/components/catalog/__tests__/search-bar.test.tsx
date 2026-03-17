import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("motion/react", async () => {
    const { motionReactMock } = await import("@/test-utils/ui-mocks");
    return motionReactMock();
});
vi.mock("@jahonbozor/ui", async () => {
    const { jahonbozorUIMock } = await import("@/test-utils/ui-mocks");
    return jahonbozorUIMock();
});

import { SearchBar } from "../search-bar";

describe("SearchBar", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("should render input with placeholder", () => {
        const { getByPlaceholderText } = render(<SearchBar onChange={() => {}} />);
        expect(getByPlaceholderText("search")).toBeDefined();
    });

    test("should render with initial value", () => {
        const { getByDisplayValue } = render(<SearchBar value="hello" onChange={() => {}} />);
        expect(getByDisplayValue("hello")).toBeDefined();
    });

    test("should accept onChange prop", () => {
        const onChange = vi.fn();
        const { getByPlaceholderText } = render(<SearchBar onChange={onChange} />);

        const input = getByPlaceholderText("search");
        expect(input).toBeDefined();
    });

    test("should update local input value immediately", () => {
        const { getByPlaceholderText } = render(<SearchBar onChange={() => {}} />);

        const input = getByPlaceholderText("search");
        fireEvent.change(input, { target: { value: "typing" } });

        expect((input as HTMLInputElement).value).toBe("typing");
    });

    test("should debounce onChange by 300ms", () => {
        const onChange = vi.fn();
        const { getByPlaceholderText } = render(<SearchBar onChange={onChange} />);

        const input = getByPlaceholderText("search");
        fireEvent.change(input, { target: { value: "test" } });

        // onChange should NOT be called immediately
        expect(onChange).not.toHaveBeenCalledWith("test");

        // After 300ms, onChange should be called
        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(onChange).toHaveBeenCalledWith("test");
    });

    test("should reset debounce timer on rapid typing", () => {
        const onChange = vi.fn();
        const { getByPlaceholderText } = render(<SearchBar onChange={onChange} />);

        const input = getByPlaceholderText("search");
        fireEvent.change(input, { target: { value: "t" } });
        act(() => { vi.advanceTimersByTime(200); });
        fireEvent.change(input, { target: { value: "te" } });
        act(() => { vi.advanceTimersByTime(200); });
        fireEvent.change(input, { target: { value: "tes" } });

        // Only the last value should be called after full 300ms
        act(() => { vi.advanceTimersByTime(300); });
        expect(onChange).toHaveBeenLastCalledWith("tes");
    });

    test("should call onChange with empty string for initial render", () => {
        const onChange = vi.fn();
        render(<SearchBar onChange={onChange} />);

        act(() => { vi.advanceTimersByTime(300); });
        expect(onChange).toHaveBeenCalledWith("");
    });
});
