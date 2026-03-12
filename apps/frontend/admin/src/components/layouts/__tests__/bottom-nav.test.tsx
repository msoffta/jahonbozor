import { describe, test, expect, mock } from "bun:test";
import { render } from "@testing-library/react";
import { setupUIMocks } from "../../../test-utils/ui-mocks";

mock.module("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

mock.module("@tanstack/react-router", () => ({
    Link: ({ children, to, ...props }: any) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
    useRouterState: ({ select }: any) =>
        select({
            location: { pathname: "/" },
            matches: [],
        }),
    useParams: () => ({}),
}));

// Setup centralized UI mocks
setupUIMocks();

// Additional mocks specific to BottomNav - LayoutGroup is from motion/react
mock.module("motion/react", () => {
    const { uiMocks } = require("../../../test-utils/ui-mocks");
    return {
        motion: uiMocks.motion,
        AnimatePresence: uiMocks.AnimatePresence,
        LayoutGroup: ({ children }: any) => <>{children}</>,
    };
});

mock.module("@tanstack/react-query", () => ({
    useQuery: () => ({ data: { orders: [] } }),
}));

mock.module("@/api/orders.api", () => ({
    orderDetailQueryOptions: () => ({}),
    ordersListQueryOptions: () => ({}),
}));

mock.module("@/components/orders/create-order-dialog", () => ({
    CreateOrderDialog: () => null,
}));

import { BottomNav } from "../bottom-nav";

describe("BottomNav", () => {
    test("should render navigation links including home and nav items", () => {
        const { getAllByRole } = render(<BottomNav />);
        const links = getAllByRole("link");
        // Should have at least: list, home, and 5 nav items (income, users, expense, products, summary)
        expect(links.length).toBeGreaterThanOrEqual(7);
    });

    test("should have correct link paths", () => {
        const { getAllByRole } = render(<BottomNav />);
        const links = getAllByRole("link");

        const hrefs = links.map((link) => link.getAttribute("href"));
        expect(hrefs).toContain("/");
        expect(hrefs).toContain("/income");
        expect(hrefs).toContain("/users");
        expect(hrefs).toContain("/expense");
        expect(hrefs).toContain("/products");
        expect(hrefs).toContain("/summary");
    });

    test("should render home link to /", () => {
        const { getAllByRole } = render(<BottomNav />);
        const links = getAllByRole("link");
        const homeLink = links.find((l) => l.getAttribute("href") === "/");
        expect(homeLink).toBeDefined();
    });

    test("should render navigation labels with i18n keys", () => {
        const { getByText } = render(<BottomNav />);

        expect(getByText("income")).toBeDefined();
        expect(getByText("clients")).toBeDefined();
        expect(getByText("expense")).toBeDefined();
        expect(getByText("warehouse")).toBeDefined();
        expect(getByText("summary")).toBeDefined();
    });

    test("should render list button with i18n key", () => {
        const { getByText } = render(<BottomNav />);
        expect(getByText("list")).toBeDefined();
    });

    test("should render add button with + symbol", () => {
        const { getByText } = render(<BottomNav />);
        expect(getByText("+")).toBeDefined();
    });

    test("should apply active styles to home when on /", () => {
        const { getAllByRole } = render(<BottomNav />);
        const links = getAllByRole("link");
        const homeLink = links.find((l) => l.getAttribute("href") === "/");

        expect(homeLink?.innerHTML).toContain("bg-primary");
    });

    test("should not apply active styles to other nav items when on /", () => {
        const { getAllByRole } = render(<BottomNav />);
        const links = getAllByRole("link");
        const incomeLink = links.find((l) => l.getAttribute("href") === "/income");

        expect(incomeLink?.className).not.toContain("bg-primary");
    });

    test("should render as a nav element", () => {
        const { container } = render(<BottomNav />);
        const nav = container.querySelector("nav");
        expect(nav).toBeDefined();
    });

    test("should have fixed positioning", () => {
        const { container } = render(<BottomNav />);
        const nav = container.querySelector("nav");
        expect(nav?.className).toContain("fixed");
        expect(nav?.className).toContain("bottom-0");
    });
});
