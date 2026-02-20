import { describe, test, expect, mock } from "bun:test";
import { render } from "@testing-library/react";

mock.module("@jahonbozor/ui", () => ({
    cn: (...args: any[]) => args.filter(Boolean).join(" "),
    motion: {
        button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    },
}));

import { Header } from "../header";

describe("Header", () => {
    test("should render logo", () => {
        const { getByAltText } = render(<Header />);
        expect(getByAltText("Jahon Bozor")).toBeDefined();
    });

    test("should render notification button", () => {
        const { getAllByRole } = render(<Header />);
        const buttons = getAllByRole("button");
        expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
});
