import { describe, test, expect, mock, beforeEach } from "bun:test";
import { render } from "@testing-library/react";
import { useCartStore } from "@/stores/cart.store";

mock.module("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

mock.module("@tanstack/react-router", () => ({
    Link: ({ children, to, ...props }: any) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
    useRouterState: ({ select }: any) => select({ location: { pathname: "/" } }),
}));

mock.module("@jahonbozor/ui", () => ({
    cn: (...args: any[]) => args.filter(Boolean).join(" "),
    motion: {
        div: ({ children, className, ...props }: any) => (
            <div className={className} data-testid={props["data-testid"]}>
                {children}
            </div>
        ),
        span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

import { BottomNav } from "../bottom-nav";

describe("BottomNav", () => {
    beforeEach(() => {
        useCartStore.setState({ items: [] });
    });

    test("should render 4 navigation links", () => {
        const { getAllByRole } = render(<BottomNav />);
        const links = getAllByRole("link");
        expect(links.length).toBe(4);
    });

    test("should have correct link paths", () => {
        const { getAllByRole } = render(<BottomNav />);
        const links = getAllByRole("link");

        const hrefs = links.map((link) => link.getAttribute("href"));
        expect(hrefs).toContain("/");
        expect(hrefs).toContain("/cart");
        expect(hrefs).toContain("/orders");
        expect(hrefs).toContain("/profile");
    });

    test("should have aria-labels for accessibility", () => {
        const { getByRole } = render(<BottomNav />);

        expect(getByRole("link", { name: "home" })).toBeDefined();
        expect(getByRole("link", { name: "cart" })).toBeDefined();
        expect(getByRole("link", { name: "orders" })).toBeDefined();
        expect(getByRole("link", { name: "profile" })).toBeDefined();
    });

    test("should not render visible text labels", () => {
        const { container } = render(<BottomNav />);
        const nav = container.querySelector("nav");

        const spans = nav?.querySelectorAll("span");
        const visibleTextSpans = Array.from(spans || []).filter(
            (span) => !span.textContent?.match(/^\d+$/),
        );
        expect(visibleTextSpans.length).toBe(0);
    });

    test("should apply active styles to current route", () => {
        const { container } = render(<BottomNav />);
        const links = container.querySelectorAll("a");
        const homeLink = Array.from(links).find((a) => a.getAttribute("href") === "/");
        const iconContainer = homeLink?.querySelector("div");

        expect(iconContainer?.className).toContain("bg-accent-muted");
    });

    test("should not show cart badge when cart is empty", () => {
        const { queryByText } = render(<BottomNav />);
        const badges = queryByText(/^\d+$/);
        expect(badges).toBeNull();
    });

    test("should show cart badge with item count", () => {
        useCartStore.setState({
            items: [
                { productId: 1, name: "A", price: 100, quantity: 2 },
                { productId: 2, name: "B", price: 200, quantity: 3 },
            ],
        });

        const { getByText } = render(<BottomNav />);
        expect(getByText("5")).toBeDefined();
    });

    test("should render gradient backdrop", () => {
        const { container } = render(<BottomNav />);
        const backdrop = container.querySelector("[class*='backdrop-blur']");
        expect(backdrop).toBeDefined();
    });
});
