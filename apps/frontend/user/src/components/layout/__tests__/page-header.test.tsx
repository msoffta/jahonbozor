import { render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, to, ...props }: any) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
}));

import { PageHeader } from "../page-header";

describe("PageHeader", () => {
    test("should render all crumb labels", () => {
        const crumbs = [
            { label: "Home", to: "/" },
            { label: "Products", to: "/products" },
            { label: "Detail" },
        ];
        const { getByText } = render(<PageHeader crumbs={crumbs} />);

        expect(getByText("Home")).toBeDefined();
        expect(getByText("Products")).toBeDefined();
        expect(getByText("Detail")).toBeDefined();
    });

    test("should render crumbs with links for items with 'to' prop", () => {
        const crumbs = [{ label: "Home", to: "/" }, { label: "Products" }];
        const { getByText } = render(<PageHeader crumbs={crumbs} />);

        const homeLink = getByText("Home").closest("a");
        expect(homeLink?.getAttribute("href")).toBe("/");

        const productsEl = getByText("Products");
        expect(productsEl.tagName).toBe("SPAN");
    });

    test("should render last crumb as bold text (no link)", () => {
        const crumbs = [{ label: "Home", to: "/" }, { label: "Current Page" }];
        const { getByText } = render(<PageHeader crumbs={crumbs} />);

        const current = getByText("Current Page");
        expect(current.className).toContain("font-semibold");
    });

    test("should render back arrow linking to first crumb with 'to'", () => {
        const crumbs = [{ label: "Home", to: "/" }, { label: "Detail" }];
        const { container } = render(<PageHeader crumbs={crumbs} />);

        const links = container.querySelectorAll("a");
        const backLink = Array.from(links).find((a) => a.getAttribute("href") === "/");
        expect(backLink).toBeDefined();
    });

    test("should default back link to / when no crumb has 'to'", () => {
        const crumbs = [{ label: "Only Label" }];
        const { container } = render(<PageHeader crumbs={crumbs} />);

        const links = container.querySelectorAll("a");
        const backLink = Array.from(links).find((a) => a.getAttribute("href") === "/");
        expect(backLink).toBeDefined();
    });

    test("should render chevron separators between crumbs", () => {
        const crumbs = [{ label: "A", to: "/" }, { label: "B", to: "/b" }, { label: "C" }];
        const { container } = render(<PageHeader crumbs={crumbs} />);

        const svgs = container.querySelectorAll("svg");
        expect(svgs.length).toBe(3);
    });
});
