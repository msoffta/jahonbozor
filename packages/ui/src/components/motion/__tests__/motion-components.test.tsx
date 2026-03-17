import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("motion/react", async () =>
    (await import("../../data-table/__tests__/test-helpers")).motionMock,
);

import { FadeIn } from "../fade-in";
import { AnimatedList, AnimatedListItem } from "../animated-list";
import { PageTransition } from "../page-transition";

// ── FadeIn ──────────────────────────────────────────────────────
describe("FadeIn", () => {
    test("should render children", () => {
        const { getByText } = render(
            <FadeIn>
                <span>Hello</span>
            </FadeIn>,
        );
        expect(getByText("Hello")).toBeDefined();
    });

    test("should apply className", () => {
        const { container } = render(
            <FadeIn className="my-class">
                <span>Test</span>
            </FadeIn>,
        );
        expect(container.firstElementChild?.className).toContain("my-class");
    });

    test("should render with delay prop", () => {
        const { getByText } = render(
            <FadeIn delay={0.5}>
                <span>Delayed</span>
            </FadeIn>,
        );
        expect(getByText("Delayed")).toBeDefined();
    });
});

// ── PageTransition ──────────────────────────────────────────────
describe("PageTransition", () => {
    test("should render children", () => {
        const { getByText } = render(
            <PageTransition>
                <h1>Page Content</h1>
            </PageTransition>,
        );
        expect(getByText("Page Content")).toBeDefined();
    });

    test("should apply className", () => {
        const { container } = render(
            <PageTransition className="page-wrapper">
                <div>Content</div>
            </PageTransition>,
        );
        expect(container.firstElementChild?.className).toContain("page-wrapper");
    });
});

// ── AnimatedList ────────────────────────────────────────────────
describe("AnimatedList", () => {
    test("should render children", () => {
        const { getByText } = render(
            <AnimatedList>
                <AnimatedListItem>Item 1</AnimatedListItem>
                <AnimatedListItem>Item 2</AnimatedListItem>
            </AnimatedList>,
        );
        expect(getByText("Item 1")).toBeDefined();
        expect(getByText("Item 2")).toBeDefined();
    });

    test("should apply className to container and items", () => {
        const { container } = render(
            <AnimatedList className="list-wrapper">
                <AnimatedListItem className="list-item">Item</AnimatedListItem>
            </AnimatedList>,
        );
        expect(container.firstElementChild?.className).toContain("list-wrapper");
        const item = container.querySelector(".list-item");
        expect(item).toBeDefined();
    });

    test("should handle empty list", () => {
        const { container } = render(<AnimatedList>{null}</AnimatedList>);
        expect(container.firstElementChild).toBeDefined();
    });
});
