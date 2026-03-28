import { render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("motion/react", async () => (await import("./test-helpers")).motionMock);
vi.mock("../../ui/button.tsx", async () => (await import("./test-helpers")).buttonMock);

import { DataTableInfiniteStatus } from "../data-table-infinite-status";

describe("DataTableInfiniteStatus", () => {
    test("should show count when hasNextPage and loaded !== total", () => {
        const { getByText } = render(
            <DataTableInfiniteStatus loadedCount={25} totalCount={100} hasNextPage={true} />,
        );
        expect(getByText("25 / 100")).toBeDefined();
    });

    test("should interpolate showingOf translation", () => {
        const { getByText } = render(
            <DataTableInfiniteStatus
                loadedCount={25}
                totalCount={100}
                hasNextPage={true}
                translations={{ showingOf: "Showing {{loaded}} of {{total}}" }}
            />,
        );
        expect(getByText("Showing 25 of 100")).toBeDefined();
    });

    test("should show loading text when fetching and hasNextPage", () => {
        const { getByText } = render(
            <DataTableInfiniteStatus
                loadedCount={25}
                totalCount={100}
                isFetchingNextPage={true}
                hasNextPage={true}
                translations={{ loadingMore: "Загрузка..." }}
            />,
        );
        expect(getByText("Загрузка...")).toBeDefined();
    });

    test("should not show loading text when hasNextPage is false", () => {
        const { queryByText } = render(
            <DataTableInfiniteStatus
                loadedCount={100}
                totalCount={100}
                isFetchingNextPage={true}
                hasNextPage={false}
                translations={{ loadingMore: "Загрузка..." }}
            />,
        );
        expect(queryByText("Загрузка...")).toBeNull();
    });

    test("should render nothing when all data loaded and no drag sum", () => {
        const { container } = render(
            <DataTableInfiniteStatus loadedCount={100} totalCount={100} hasNextPage={false} />,
        );
        // Component returns null — empty div
        expect(container.innerHTML).toBe("");
    });

    test("should show drag sum info even when all data loaded", () => {
        const { getByText, container } = render(
            <DataTableInfiniteStatus
                loadedCount={100}
                totalCount={100}
                hasNextPage={false}
                dragSumInfo={{ sum: 1500, count: 3 }}
                translations={{ sumLabel: "Sum" }}
            />,
        );
        expect(getByText(/Sum/)).toBeDefined();
        const sumEl = container.querySelector(".font-semibold");
        expect(sumEl?.textContent).toContain("1");
        expect(sumEl?.textContent).toContain("500");
    });

    test("should have a copy button when drag sum is shown", () => {
        const { getAllByRole } = render(
            <DataTableInfiniteStatus
                loadedCount={10}
                totalCount={50}
                hasNextPage={true}
                dragSumInfo={{ sum: 1500, count: 3 }}
            />,
        );

        const buttons = getAllByRole("button");
        expect(buttons.length).toBeGreaterThan(0);
    });

    test("should not show count when loaded equals total", () => {
        const { container } = render(
            <DataTableInfiniteStatus loadedCount={50} totalCount={50} hasNextPage={false} />,
        );
        expect(container.innerHTML).toBe("");
    });
});
