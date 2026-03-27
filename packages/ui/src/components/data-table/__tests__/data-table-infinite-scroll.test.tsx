import { fireEvent, render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("motion/react", async () => (await import("./test-helpers")).motionMock);
vi.mock("../../ui/button.tsx", async () => (await import("./test-helpers")).buttonMock);
vi.mock("../../ui/checkbox.tsx", async () => (await import("./test-helpers")).checkboxMock);
vi.mock("../../ui/select.tsx", async () => (await import("./test-helpers")).selectMock);
vi.mock("../../ui/table.tsx", async () => (await import("./test-helpers")).tableMock);
vi.mock(
    "../../ui/dropdown-menu.tsx",
    async () => (await import("./test-helpers")).dropdownMenuMock,
);

import { DataTable } from "../data-table";

import type { ColumnDef } from "@tanstack/react-table";

// ── Test data ──────────────────────────────────────────────────
interface TestRow {
    id: number;
    name: string;
}

const testData: TestRow[] = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    name: `Row ${i + 1}`,
}));

const columns: ColumnDef<TestRow, any>[] = [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "name", header: "Name" },
];

// ── Tests ──────────────────────────────────────────────────────
describe("DataTable - Infinite Scroll", () => {
    test("should render status bar without pagination controls when enableInfiniteScroll is true", () => {
        const { getByText, queryByText } = render(
            <DataTable
                columns={columns}
                data={testData}
                enableInfiniteScroll
                hasNextPage={true}
                totalCount={100}
            />,
        );

        // Headers render
        expect(getByText("ID")).toBeDefined();
        expect(getByText("Name")).toBeDefined();

        // Status bar shows count (hasNextPage=true so count is visible)
        expect(getByText("10 / 100")).toBeDefined();

        // No pagination controls
        expect(queryByText("Rows per page")).toBeNull();
    });

    test("should show loading indicator when isFetchingNextPage is true", () => {
        const { getByText } = render(
            <DataTable
                columns={columns}
                data={testData}
                enableInfiniteScroll
                isFetchingNextPage={true}
                hasNextPage={true}
                totalCount={100}
                translations={{ loadingMore: "Loading more..." }}
            />,
        );

        expect(getByText("Loading more...")).toBeDefined();
    });

    test("should not show loading indicator when isFetchingNextPage is false", () => {
        const { queryByText } = render(
            <DataTable
                columns={columns}
                data={testData}
                enableInfiniteScroll
                isFetchingNextPage={false}
                hasNextPage={true}
                totalCount={100}
                translations={{ loadingMore: "Loading more..." }}
            />,
        );

        expect(queryByText("Loading more...")).toBeNull();
    });

    test("should display custom showingOf translation with interpolation", () => {
        const { getByText } = render(
            <DataTable
                columns={columns}
                data={testData}
                enableInfiniteScroll
                hasNextPage={true}
                totalCount={50}
                translations={{ showingOf: "Showing {{loaded}} of {{total}}" }}
            />,
        );

        expect(getByText("Showing 10 of 50")).toBeDefined();
    });

    test("should call onFetchNextPage when scrolled near bottom", () => {
        const fetchNextPage = vi.fn();

        const { container } = render(
            <DataTable
                columns={columns}
                data={testData}
                enableInfiniteScroll
                onFetchNextPage={fetchNextPage}
                hasNextPage={true}
                isFetchingNextPage={false}
                totalCount={100}
            />,
        );

        const scrollContainer = container.querySelector(".overflow-x-hidden");
        expect(scrollContainer).toBeDefined();

        // Simulate scroll near bottom using defineProperty with configurable
        Object.defineProperty(scrollContainer!, "scrollHeight", {
            value: 1000,
            configurable: true,
        });
        Object.defineProperty(scrollContainer!, "scrollTop", {
            value: 600,
            configurable: true,
            writable: true,
        });
        Object.defineProperty(scrollContainer!, "clientHeight", { value: 200, configurable: true });

        fireEvent.scroll(scrollContainer!);

        expect(fetchNextPage).toHaveBeenCalled();
    });

    test("should NOT call onFetchNextPage when hasNextPage is false", () => {
        const fetchNextPage = vi.fn();

        const { container } = render(
            <DataTable
                columns={columns}
                data={testData}
                enableInfiniteScroll
                onFetchNextPage={fetchNextPage}
                hasNextPage={false}
                isFetchingNextPage={false}
                totalCount={10}
            />,
        );

        const scrollContainer = container.querySelector(".overflow-x-hidden");

        Object.defineProperty(scrollContainer!, "scrollHeight", {
            value: 1000,
            configurable: true,
        });
        Object.defineProperty(scrollContainer!, "scrollTop", {
            value: 600,
            configurable: true,
            writable: true,
        });
        Object.defineProperty(scrollContainer!, "clientHeight", { value: 200, configurable: true });

        fireEvent.scroll(scrollContainer!);

        expect(fetchNextPage).not.toHaveBeenCalled();
    });

    test("should NOT call onFetchNextPage when isFetchingNextPage is true", () => {
        const fetchNextPage = vi.fn();

        const { container } = render(
            <DataTable
                columns={columns}
                data={testData}
                enableInfiniteScroll
                onFetchNextPage={fetchNextPage}
                hasNextPage={true}
                isFetchingNextPage={true}
                totalCount={100}
            />,
        );

        const scrollContainer = container.querySelector(".overflow-x-hidden");

        Object.defineProperty(scrollContainer!, "scrollHeight", {
            value: 1000,
            configurable: true,
        });
        Object.defineProperty(scrollContainer!, "scrollTop", {
            value: 600,
            configurable: true,
            writable: true,
        });
        Object.defineProperty(scrollContainer!, "clientHeight", { value: 200, configurable: true });

        fireEvent.scroll(scrollContainer!);

        expect(fetchNextPage).not.toHaveBeenCalled();
    });

    test("should still render pagination when pagination=true and enableInfiniteScroll=false", () => {
        const { getByText } = render(
            <DataTable
                columns={columns}
                data={testData}
                pagination
                translations={{ rowsPerPage: "Rows per page" }}
            />,
        );

        expect(getByText("Rows per page")).toBeDefined();
    });

    test("should enable sorting header interaction with infinite scroll", () => {
        const { getByText } = render(
            <DataTable
                columns={columns}
                data={testData}
                enableInfiniteScroll
                enableSorting
                hasNextPage={true}
                totalCount={100}
            />,
        );

        // Sorting headers should be clickable without errors
        fireEvent.click(getByText("Name"));
        fireEvent.click(getByText("ID"));

        // Status bar still renders
        expect(getByText("10 / 100")).toBeDefined();
    });
});
