import { describe, test, expect, mock, beforeEach } from "bun:test";
import { createElement } from "react";
import { render } from "@testing-library/react";
import { useAuthStore } from "@/stores/auth.store";

mock.module("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

mock.module("@tanstack/react-router", () => ({
    Link: ({ children, to, ...props }: any) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
}));

mock.module("@jahonbozor/ui", () => ({
    cn: (...args: any[]) => args.filter(Boolean).join(" "),
    DropdownMenu: ({ children }: any) => <div data-testid="dropdown">{children}</div>,
    DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
    DropdownMenuItem: ({ children, onClick, ...props }: any) => (
        <button type="button" onClick={onClick} {...props}>
            {children}
        </button>
    ),
    DropdownMenuLabel: ({ children }: any) => <span>{children}</span>,
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
    motion: new Proxy(
        {},
        {
            get: (_target: any, prop: string) =>
                ({ children, className, ...rest }: any) =>
                    createElement(prop, { className, ...rest }, children),
        },
    ),
}));

const mockLogout = mock(() => {});

mock.module("@/hooks/use-auth", () => ({
    useLogout: () => ({ mutate: mockLogout }),
}));

import { Header } from "../header";

describe("Header", () => {
    beforeEach(() => {
        useAuthStore.setState({
            token: null,
            user: null,
            permissions: [],
            isAuthenticated: false,
        });
    });

    test("should render logo image", () => {
        const { getByAltText } = render(<Header />);
        expect(getByAltText("Jahon Bozor")).toBeDefined();
    });

    test("should render logo with link to home", () => {
        const { getByAltText } = render(<Header />);
        const logo = getByAltText("Jahon Bozor");
        const link = logo.closest("a");
        expect(link?.getAttribute("href")).toBe("/");
    });

    test("should render notification bell button", () => {
        const { getAllByRole } = render(<Header />);
        const buttons = getAllByRole("button");
        expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    test("should display user fullname when logged in", () => {
        useAuthStore.setState({
            user: {
                id: 1,
                fullname: "Admin User",
                username: "admin",
                roleId: 1,
                type: "staff",
            },
            isAuthenticated: true,
        });

        const { getByText } = render(<Header />);
        expect(getByText("Admin User")).toBeDefined();
    });

    test("should not display user label when not logged in", () => {
        const { queryByText } = render(<Header />);
        // No user set, so no fullname rendered
        expect(queryByText("Admin User")).toBeNull();
    });

    test("should render profile link", () => {
        const { getByText } = render(<Header />);
        const profileLink = getByText("profile");
        expect(profileLink.closest("a")?.getAttribute("href")).toBe("/profile");
    });

    test("should render settings link", () => {
        const { getByText } = render(<Header />);
        const settingsLink = getByText("settings");
        expect(settingsLink.closest("a")?.getAttribute("href")).toBe("/settings");
    });

    test("should render logout button with i18n key", () => {
        const { getByText } = render(<Header />);
        expect(getByText("logout")).toBeDefined();
    });

    test("should render notifications label with i18n key", () => {
        const { getByText } = render(<Header />);
        expect(getByText("notifications")).toBeDefined();
    });

    test("should render no_notifications message", () => {
        const { getByText } = render(<Header />);
        expect(getByText("no_notifications")).toBeDefined();
    });
});
