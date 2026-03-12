import { describe, test, expect, mock } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import { setupUIMocks } from "../../../test-utils/ui-mocks";

mock.module("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

// Setup centralized UI mocks
setupUIMocks();

import { SearchBar } from "../search-bar";

describe("SearchBar", () => {

    test("should render input with placeholder", () => {
        const { getByPlaceholderText } = render(<SearchBar onChange={() => {}} />);
        expect(getByPlaceholderText("search")).toBeDefined();
    });

    test("should render with initial value", () => {
        const { getByDisplayValue } = render(<SearchBar value="hello" onChange={() => {}} />);
        expect(getByDisplayValue("hello")).toBeDefined();
    });

    test("should accept onChange prop", () => {
        const onChange = mock(() => {});
        const { getByPlaceholderText } = render(<SearchBar onChange={onChange} />);

        // Component renders with input and accepts onChange callback
        const input = getByPlaceholderText("search");
        expect(input).toBeDefined();
    });

    test("should update local input value immediately", () => {
        const { getByPlaceholderText } = render(<SearchBar onChange={() => {}} />);

        const input = getByPlaceholderText("search");
        fireEvent.change(input, { target: { value: "typing" } });

        expect((input as HTMLInputElement).value).toBe("typing");
    });
});
