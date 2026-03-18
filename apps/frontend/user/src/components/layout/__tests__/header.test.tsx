import { render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, to, ...props }: any) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
}));

vi.mock("motion/react", async () => {
    const { motionReactMock } = await import("@/test-utils/ui-mocks");
    return motionReactMock();
});
vi.mock("@jahonbozor/ui", async () => {
    const { jahonbozorUIMock } = await import("@/test-utils/ui-mocks");
    return jahonbozorUIMock();
});

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
