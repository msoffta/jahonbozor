import { describe, test, expect, mock } from "bun:test";
import { render } from "@testing-library/react";

mock.module("@tanstack/react-router", () => ({
    Link: ({ children, to, ...props }: any) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
}));

mock.module("@jahonbozor/ui", () => ({
    cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

import { Header } from "../header";

describe("Header", () => {
    test("should render logo", () => {
        const { getByAltText } = render(<Header />);
        expect(getByAltText("Jahon Bozor")).toBeDefined();
    });

    test("should render logo link to home", () => {
        const { getByAltText } = render(<Header />);
        const logo = getByAltText("Jahon Bozor");
        const link = logo.closest("a");
        expect(link?.getAttribute("href")).toBe("/");
    });

    test("should render profile link", () => {
        const { container } = render(<Header />);
        const links = container.querySelectorAll("a");
        const profileLink = Array.from(links).find((a) => a.getAttribute("href") === "/profile");
        expect(profileLink).toBeDefined();
    });
});
