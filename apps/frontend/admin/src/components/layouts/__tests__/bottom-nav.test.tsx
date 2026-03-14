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

// Mock permission hooks with configurable return values
let permissionMocks: Record<string, boolean> = {};

mock.module("@/hooks/use-permissions", () => ({
    useHasPermission: (permission: string) => permissionMocks[permission] || false,
    useHasAnyPermission: (permissions: string[]) =>
        permissions.some(p => permissionMocks[p]) || false,
}));

import { BottomNav } from "../bottom-nav";
import { beforeEach } from "bun:test";

describe("BottomNav", () => {
    beforeEach(() => {
        // Reset permission mocks before each test
        permissionMocks = {};
    });

    test("should render only home when user has no permissions", () => {
        const { getAllByRole, queryByText } = render(<BottomNav />);
        const links = getAllByRole("link");
        const hrefs = links.map(l => l.getAttribute("href"));

        // Home should be present
        expect(hrefs).toContain("/");

        // No nav items should be visible
        expect(queryByText("income")).toBeNull();
        expect(queryByText("clients")).toBeNull();
        expect(queryByText("expense")).toBeNull();
        expect(queryByText("warehouse")).toBeNull();
        expect(queryByText("summary")).toBeNull();
        expect(queryByText("list")).toBeNull();
    });

    test("should render navigation with all permissions", () => {
        // Grant all permissions
        permissionMocks = {
            "analytics:view": true,
            "product-history:list": true,
            "users:list": true,
            "expenses:list": true,
            "products:list": true,
            "orders:create": true,
            "orders:list:all": true,
        };

        const { getAllByRole, getByText } = render(<BottomNav />);
        const links = getAllByRole("link");
        const hrefs = links.map(l => l.getAttribute("href"));

        // All nav items should be present
        expect(hrefs).toContain("/");
        expect(hrefs).toContain("/orders");
        expect(hrefs).toContain("/income");
        expect(hrefs).toContain("/users");
        expect(hrefs).toContain("/expense");
        expect(hrefs).toContain("/products");
        expect(hrefs).toContain("/summary");

        // Action buttons should be visible
        expect(getByText("list")).toBeDefined();
        expect(getByText("+")).toBeDefined();
    });

    test("should have correct link paths with all permissions", () => {
        permissionMocks = {
            "analytics:view": true,
            "product-history:list": true,
            "users:list": true,
            "expenses:list": true,
            "products:list": true,
            "orders:list:all": true,
        };

        const { getAllByRole } = render(<BottomNav />);
        const links = getAllByRole("link");

        const hrefs = links.map((link) => link.getAttribute("href"));
        expect(hrefs).toContain("/");
        expect(hrefs).toContain("/orders");
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

    test("should render navigation labels with permissions", () => {
        permissionMocks = {
            "product-history:list": true,
            "users:list": true,
            "expenses:list": true,
            "products:list": true,
        };

        const { getByText, queryByText } = render(<BottomNav />);

        expect(getByText("income")).toBeDefined();
        expect(getByText("clients")).toBeDefined();
        expect(getByText("expense")).toBeDefined();
        expect(getByText("warehouse")).toBeDefined();
        // Summary is hidden without ANALYTICS_VIEW permission
        expect(queryByText("summary")).toBeNull();
    });

    test("should render list button with ORDERS_LIST permission", () => {
        permissionMocks = { "orders:list:all": true };
        const { getByText } = render(<BottomNav />);
        expect(getByText("list")).toBeDefined();
    });

    test("should hide list button without ORDERS_LIST permission", () => {
        const { queryByText } = render(<BottomNav />);
        expect(queryByText("list")).toBeNull();
    });

    test("should render add button with ORDERS_CREATE permission", () => {
        permissionMocks = { "orders:create": true };
        const { getByText } = render(<BottomNav />);
        expect(getByText("+")).toBeDefined();
    });

    test("should hide add button without ORDERS_CREATE permission", () => {
        const { queryByText } = render(<BottomNav />);
        expect(queryByText("+")).toBeNull();
    });

    test("should hide income nav without PRODUCT_HISTORY_LIST permission", () => {
        const { queryByText } = render(<BottomNav />);
        expect(queryByText("income")).toBeNull();
    });

    test("should show income nav with PRODUCT_HISTORY_LIST permission", () => {
        permissionMocks = { "product-history:list": true };
        const { getByText } = render(<BottomNav />);
        expect(getByText("income")).toBeDefined();
    });

    test("should hide users nav without USERS_LIST permission", () => {
        const { queryByText } = render(<BottomNav />);
        expect(queryByText("clients")).toBeNull();
    });

    test("should show users nav with USERS_LIST permission", () => {
        permissionMocks = { "users:list": true };
        const { getByText } = render(<BottomNav />);
        expect(getByText("clients")).toBeDefined();
    });

    test("should hide expenses nav without EXPENSES_LIST permission", () => {
        const { queryByText } = render(<BottomNav />);
        expect(queryByText("expense")).toBeNull();
    });

    test("should show expenses nav with EXPENSES_LIST permission", () => {
        permissionMocks = { "expenses:list": true };
        const { getByText } = render(<BottomNav />);
        expect(getByText("expense")).toBeDefined();
    });

    test("should hide products nav without PRODUCTS_LIST permission", () => {
        const { queryByText } = render(<BottomNav />);
        expect(queryByText("warehouse")).toBeNull();
    });

    test("should show products nav with PRODUCTS_LIST permission", () => {
        permissionMocks = { "products:list": true };
        const { getByText } = render(<BottomNav />);
        expect(getByText("warehouse")).toBeDefined();
    });

    test("should hide summary nav without ANALYTICS_VIEW permission", () => {
        const { queryByText } = render(<BottomNav />);
        expect(queryByText("summary")).toBeNull();
    });

    test("should show summary nav with ANALYTICS_VIEW permission", () => {
        permissionMocks = { "analytics:view": true };
        const { getByText } = render(<BottomNav />);
        expect(getByText("summary")).toBeDefined();
    });

    test("should apply active styles to home when on /", () => {
        const { getAllByRole } = render(<BottomNav />);
        const links = getAllByRole("link");
        const homeLink = links.find((l) => l.getAttribute("href") === "/");

        expect(homeLink?.innerHTML).toContain("bg-primary");
    });

    test("should not apply active styles to other nav items when on /", () => {
        permissionMocks = { "product-history:list": true };
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
