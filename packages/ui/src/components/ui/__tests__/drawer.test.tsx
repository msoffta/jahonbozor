import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("motion/react", async () =>
    (await import("../../data-table/__tests__/test-helpers")).motionMock,
);

import {
    Drawer,
    DrawerHeader,
    DrawerTitle,
    DrawerContent,
    DrawerFooter,
    ScrollArea,
} from "../drawer";

// ── Helpers ─────────────────────────────────────────────────────
afterEach(() => {
    document.body.style.overflow = "";
});

// ── Drawer ──────────────────────────────────────────────────────
describe("Drawer", () => {
    let onOpenChange: ReturnType<typeof vi.fn<(open: boolean) => void>>;

    beforeEach(() => {
        onOpenChange = vi.fn<(open: boolean) => void>();
    });

    // ── Happy path ──────────────────────────────────────────────
    test("should render children when open is true", () => {
        render(
            <Drawer open={true} onOpenChange={onOpenChange}>
                <span>Drawer Content</span>
            </Drawer>,
        );

        expect(screen.getByText("Drawer Content")).toBeDefined();
    });

    test("should not render children when open is false", () => {
        render(
            <Drawer open={false} onOpenChange={onOpenChange}>
                <span>Hidden Content</span>
            </Drawer>,
        );

        expect(screen.queryByText("Hidden Content")).toBeNull();
    });

    // ── Backdrop click ──────────────────────────────────────────
    test("should call onOpenChange(false) when backdrop is clicked", async () => {
        const user = userEvent.setup();

        render(
            <Drawer open={true} onOpenChange={onOpenChange}>
                <span>Content</span>
            </Drawer>,
        );

        // The backdrop is the first motion.div with bg-black/60 class
        const backdrop = document.querySelector(".bg-black\\/60");
        expect(backdrop).toBeDefined();
        await user.click(backdrop as Element);

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    // ── Body scroll lock ────────────────────────────────────────
    test("should lock body scroll when open", () => {
        render(
            <Drawer open={true} onOpenChange={onOpenChange}>
                <span>Content</span>
            </Drawer>,
        );

        expect(document.body.style.overflow).toBe("hidden");
    });

    test("should restore body scroll when closed after being open", () => {
        const { rerender } = render(
            <Drawer open={true} onOpenChange={onOpenChange}>
                <span>Content</span>
            </Drawer>,
        );

        expect(document.body.style.overflow).toBe("hidden");

        rerender(
            <Drawer open={false} onOpenChange={onOpenChange}>
                <span>Content</span>
            </Drawer>,
        );

        expect(document.body.style.overflow).toBe("");
    });

    test("should restore body scroll on unmount while open", () => {
        const { unmount } = render(
            <Drawer open={true} onOpenChange={onOpenChange}>
                <span>Content</span>
            </Drawer>,
        );

        expect(document.body.style.overflow).toBe("hidden");
        unmount();
        expect(document.body.style.overflow).toBe("");
    });

    // ── Portal rendering ────────────────────────────────────────
    test("should render via portal into document.body", () => {
        const { container } = render(
            <Drawer open={true} onOpenChange={onOpenChange}>
                <span>Portal Content</span>
            </Drawer>,
        );

        // Container should not contain the content (it's portaled)
        expect(container.querySelector("span")).toBeNull();
        // But document.body should
        expect(document.body.querySelector("span")).not.toBeNull();
        expect(screen.getByText("Portal Content")).toBeDefined();
    });

    // ── Swipe handle (mobile indicator) ─────────────────────────
    test("should render mobile swipe handle", () => {
        render(
            <Drawer open={true} onOpenChange={onOpenChange}>
                <span>Content</span>
            </Drawer>,
        );

        // The swipe handle has specific dimensions: h-1.5 w-12 rounded-full
        const handle = document.querySelector(".rounded-full");
        expect(handle).toBeDefined();
        expect(handle).not.toBeNull();
    });
});

// ── DrawerHeader ────────────────────────────────────────────────
describe("DrawerHeader", () => {
    test("should render with default class", () => {
        const { container } = render(
            <DrawerHeader>Header Text</DrawerHeader>,
        );

        const el = container.firstElementChild as HTMLElement;
        expect(el.className).toContain("px-6");
        expect(el.className).toContain("pt-4");
        expect(el.className).toContain("pb-2");
        expect(el.textContent).toBe("Header Text");
    });

    test("should render with custom className", () => {
        const { container } = render(
            <DrawerHeader className="my-custom-header">Header</DrawerHeader>,
        );

        const el = container.firstElementChild as HTMLElement;
        expect(el.className).toContain("my-custom-header");
        expect(el.className).toContain("px-6");
    });

    test("should pass additional HTML props", () => {
        render(
            <DrawerHeader data-testid="header-el">Header</DrawerHeader>,
        );

        expect(screen.getByTestId("header-el")).toBeDefined();
    });
});

// ── DrawerTitle ─────────────────────────────────────────────────
describe("DrawerTitle", () => {
    test("should render as h2 element", () => {
        render(<DrawerTitle>My Title</DrawerTitle>);

        const heading = screen.getByRole("heading", { level: 2 });
        expect(heading).toBeDefined();
        expect(heading.textContent).toBe("My Title");
    });

    test("should apply font-bold class", () => {
        const { container } = render(<DrawerTitle>Title</DrawerTitle>);

        const el = container.firstElementChild as HTMLElement;
        expect(el.className).toContain("font-bold");
        expect(el.className).toContain("text-xl");
    });

    test("should render with custom className", () => {
        const { container } = render(
            <DrawerTitle className="extra-title">Title</DrawerTitle>,
        );

        const el = container.firstElementChild as HTMLElement;
        expect(el.className).toContain("extra-title");
    });
});

// ── DrawerContent ───────────────────────────────────────────────
describe("DrawerContent", () => {
    test("should render children", () => {
        render(<DrawerContent>Body content here</DrawerContent>);

        expect(screen.getByText("Body content here")).toBeDefined();
    });

    test("should render with flex-1 and overflow-hidden classes", () => {
        const { container } = render(
            <DrawerContent>Content</DrawerContent>,
        );

        const el = container.firstElementChild as HTMLElement;
        expect(el.className).toContain("flex-1");
        expect(el.className).toContain("overflow-hidden");
        expect(el.className).toContain("px-6");
    });

    test("should render with custom className", () => {
        const { container } = render(
            <DrawerContent className="custom-content">Content</DrawerContent>,
        );

        const el = container.firstElementChild as HTMLElement;
        expect(el.className).toContain("custom-content");
    });
});

// ── DrawerFooter ────────────────────────────────────────────────
describe("DrawerFooter", () => {
    test("should render children", () => {
        render(<DrawerFooter>Footer text</DrawerFooter>);

        expect(screen.getByText("Footer text")).toBeDefined();
    });

    test("should render with border-t class", () => {
        const { container } = render(
            <DrawerFooter>Footer</DrawerFooter>,
        );

        const el = container.firstElementChild as HTMLElement;
        expect(el.className).toContain("border-t");
        expect(el.className).toContain("px-6");
        expect(el.className).toContain("py-4");
    });

    test("should render with custom className", () => {
        const { container } = render(
            <DrawerFooter className="my-footer">Footer</DrawerFooter>,
        );

        const el = container.firstElementChild as HTMLElement;
        expect(el.className).toContain("my-footer");
        expect(el.className).toContain("border-t");
    });
});

// ── ScrollArea ──────────────────────────────────────────────────
describe("ScrollArea", () => {
    test("should render children", () => {
        render(<ScrollArea>Scrollable content</ScrollArea>);

        expect(screen.getByText("Scrollable content")).toBeDefined();
    });

    test("should render with overflow-y-auto class", () => {
        const { container } = render(
            <ScrollArea>Content</ScrollArea>,
        );

        const el = container.firstElementChild as HTMLElement;
        expect(el.className).toContain("overflow-y-auto");
    });

    test("should render with custom-scrollbar class", () => {
        const { container } = render(
            <ScrollArea>Content</ScrollArea>,
        );

        const el = container.firstElementChild as HTMLElement;
        expect(el.className).toContain("custom-scrollbar");
    });

    test("should render with custom className", () => {
        const { container } = render(
            <ScrollArea className="extra-scroll">Content</ScrollArea>,
        );

        const el = container.firstElementChild as HTMLElement;
        expect(el.className).toContain("extra-scroll");
        expect(el.className).toContain("overflow-y-auto");
    });
});
