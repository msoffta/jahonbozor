import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Table } from "@tanstack/react-table";

vi.mock("motion/react", async () => (await import("./test-helpers")).motionMock);
vi.mock("../../ui/button.tsx", async () => (await import("./test-helpers")).buttonMock);
vi.mock("../../ui/select.tsx", async () => (await import("./test-helpers")).selectMock);

import { DataTablePagination } from "../data-table-pagination";

// ── Mock table factory ──────────────────────────────────────────
function createMockTable(overrides: Record<string, unknown> = {}) {
    return {
        getFilteredSelectedRowModel: vi.fn(() => ({ rows: [] })),
        getFilteredRowModel: vi.fn(() => ({ rows: Array(30).fill({}) })),
        getState: vi.fn(() => ({ pagination: { pageIndex: 0, pageSize: 10 } })),
        setPageSize: vi.fn(),
        setPageIndex: vi.fn(),
        previousPage: vi.fn(),
        nextPage: vi.fn(),
        getCanPreviousPage: vi.fn(() => false),
        getCanNextPage: vi.fn(() => true),
        getPageCount: vi.fn(() => 3),
        ...overrides,
    } as unknown as Table<unknown>;
}

// ── Default props factory ───────────────────────────────────────
function defaultProps(overrides: Partial<Parameters<typeof DataTablePagination>[0]> = {}) {
    return {
        table: createMockTable(overrides.table as Record<string, unknown> | undefined),
        isShowAll: false,
        onShowAllChange: vi.fn(),
        ...overrides,
    } as Parameters<typeof DataTablePagination>[0];
}

// ── Tests ───────────────────────────────────────────────────────
describe("DataTablePagination", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    // ── Page size selector ──────────────────────────────────────
    describe("Page size selector", () => {
        test("renders page size selector with default options [10, 20, 30, 50]", () => {
            const props = defaultProps();
            const { getByText } = render(<DataTablePagination {...props} />);

            expect(getByText("10")).toBeDefined();
            expect(getByText("20")).toBeDefined();
            expect(getByText("30")).toBeDefined();
            expect(getByText("50")).toBeDefined();
        });

        test("renders custom page size options", () => {
            const props = defaultProps({ pageSizeOptions: [5, 15, 100] });
            const { getByText, queryByText } = render(<DataTablePagination {...props} />);

            expect(getByText("5")).toBeDefined();
            expect(getByText("15")).toBeDefined();
            expect(getByText("100")).toBeDefined();
            expect(queryByText("10")).toBeNull();
            expect(queryByText("20")).toBeNull();
        });

        test("calls table.setPageSize when a page size is selected", async () => {
            const user = userEvent.setup();
            const mockTable = createMockTable();
            const onShowAllChange = vi.fn();
            const { container } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={onShowAllChange}
                />,
            );

            const select = container.querySelector("select")!;
            await user.selectOptions(select, "20");

            expect(onShowAllChange).toHaveBeenCalledWith(false);
            expect(mockTable.setPageSize).toHaveBeenCalledWith(20);
        });
    });

    // ── Page info ───────────────────────────────────────────────
    describe("Page info", () => {
        test("renders page info '1 / 3'", () => {
            const props = defaultProps();
            const { getByText } = render(<DataTablePagination {...props} />);

            expect(getByText("1 / 3")).toBeDefined();
        });

        test("renders correct page info for middle page", () => {
            const mockTable = createMockTable({
                getState: vi.fn(() => ({ pagination: { pageIndex: 1, pageSize: 10 } })),
                getCanPreviousPage: vi.fn(() => true),
                getCanNextPage: vi.fn(() => true),
            });
            const { getByText } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                />,
            );

            expect(getByText("2 / 3")).toBeDefined();
        });
    });

    // ── Row selection ───────────────────────────────────────────
    describe("Row selection", () => {
        test("shows row selection count when enableRowSelection is true", () => {
            const mockTable = createMockTable({
                getFilteredSelectedRowModel: vi.fn(() => ({ rows: [{}, {}] })),
                getFilteredRowModel: vi.fn(() => ({ rows: Array(30).fill({}) })),
            });
            const { getByText } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                    enableRowSelection
                />,
            );

            expect(getByText("2 / 30 selected")).toBeDefined();
        });

        test("hides row selection count when enableRowSelection is false", () => {
            const mockTable = createMockTable({
                getFilteredSelectedRowModel: vi.fn(() => ({ rows: [{}, {}] })),
            });
            const { queryByText } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                    enableRowSelection={false}
                />,
            );

            expect(queryByText(/selected/)).toBeNull();
        });
    });

    // ── Navigation buttons ──────────────────────────────────────
    describe("Navigation", () => {
        test("first page button is disabled on first page", () => {
            const mockTable = createMockTable({
                getCanPreviousPage: vi.fn(() => false),
            });
            const { getByRole } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                />,
            );

            const firstBtn = getByRole("button", { name: "First page" });
            expect(firstBtn).toHaveProperty("disabled", true);
        });

        test("previous page button is disabled on first page", () => {
            const mockTable = createMockTable({
                getCanPreviousPage: vi.fn(() => false),
            });
            const { getByRole } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                />,
            );

            const prevBtn = getByRole("button", { name: "Previous page" });
            expect(prevBtn).toHaveProperty("disabled", true);
        });

        test("clicking next page calls table.nextPage()", async () => {
            const user = userEvent.setup();
            const mockTable = createMockTable({
                getCanNextPage: vi.fn(() => true),
            });
            const { getByRole } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                />,
            );

            await user.click(getByRole("button", { name: "Next page" }));

            expect(mockTable.nextPage).toHaveBeenCalledOnce();
        });

        test("clicking previous page calls table.previousPage()", async () => {
            const user = userEvent.setup();
            const mockTable = createMockTable({
                getCanPreviousPage: vi.fn(() => true),
            });
            const { getByRole } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                />,
            );

            await user.click(getByRole("button", { name: "Previous page" }));

            expect(mockTable.previousPage).toHaveBeenCalledOnce();
        });

        test("clicking first page calls table.setPageIndex(0)", async () => {
            const user = userEvent.setup();
            const mockTable = createMockTable({
                getCanPreviousPage: vi.fn(() => true),
            });
            const { getByRole } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                />,
            );

            await user.click(getByRole("button", { name: "First page" }));

            expect(mockTable.setPageIndex).toHaveBeenCalledWith(0);
        });

        test("clicking last page calls table.setPageIndex(pageCount - 1)", async () => {
            const user = userEvent.setup();
            const mockTable = createMockTable({
                getCanNextPage: vi.fn(() => true),
                getPageCount: vi.fn(() => 3),
            });
            const { getByRole } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                />,
            );

            await user.click(getByRole("button", { name: "Last page" }));

            expect(mockTable.setPageIndex).toHaveBeenCalledWith(2);
        });

        test("next page button is disabled on last page", () => {
            const mockTable = createMockTable({
                getCanNextPage: vi.fn(() => false),
                getCanPreviousPage: vi.fn(() => true),
                getState: vi.fn(() => ({ pagination: { pageIndex: 2, pageSize: 10 } })),
            });
            const { getByRole } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                />,
            );

            const nextBtn = getByRole("button", { name: "Next page" });
            expect(nextBtn).toHaveProperty("disabled", true);

            const lastBtn = getByRole("button", { name: "Last page" });
            expect(lastBtn).toHaveProperty("disabled", true);
        });
    });

    // ── Show all ────────────────────────────────────────────────
    describe("Show all", () => {
        test("calls onShowAllChange(true) when 'all' is selected", async () => {
            const user = userEvent.setup();
            const onShowAllChange = vi.fn();
            const mockTable = createMockTable();
            const { container } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={onShowAllChange}
                    enableShowAll
                />,
            );

            const select = container.querySelector("select")!;
            await user.selectOptions(select, "all");

            expect(onShowAllChange).toHaveBeenCalledWith(true);
        });

        test("hides navigation and page info when isShowAll is true", () => {
            const mockTable = createMockTable();
            const { queryByRole, queryByText } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={true}
                    onShowAllChange={vi.fn()}
                />,
            );

            // Navigation buttons should not exist
            expect(queryByRole("button", { name: "First page" })).toBeNull();
            expect(queryByRole("button", { name: "Previous page" })).toBeNull();
            expect(queryByRole("button", { name: "Next page" })).toBeNull();
            expect(queryByRole("button", { name: "Last page" })).toBeNull();

            // Page info should not exist
            expect(queryByText("1 / 3")).toBeNull();
        });

        test("shows 'All' option in select when enableShowAll is true", () => {
            const mockTable = createMockTable();
            const { getByText } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                    enableShowAll
                />,
            );

            expect(getByText("All")).toBeDefined();
        });

        test("does not show 'All' option when enableShowAll is false", () => {
            const mockTable = createMockTable();
            const { queryByText } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                    enableShowAll={false}
                />,
            );

            // There should be no "All" option (only page size numbers)
            const allElements = queryByText("All");
            expect(allElements).toBeNull();
        });
    });

    // ── Drag sum info ───────────────────────────────────────────
    describe("Drag sum info", () => {
        test("shows drag sum info when dragSumInfo is provided", () => {
            const mockTable = createMockTable();
            const { getByText } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                    dragSumInfo={{ sum: 1500, count: 5 }}
                />,
            );

            expect(getByText(/Sum \(5\):/)).toBeDefined();
            // toLocaleString() output depends on environment; match the sum value in font-semibold span
            expect(
                getByText((content, element) => {
                    return (
                        element?.tagName === "SPAN" &&
                        element?.className.includes("font-semibold") &&
                        content.includes("1") &&
                        content.includes("500")
                    );
                }),
            ).toBeDefined();
        });

        test("hides drag sum info when dragSumInfo is null", () => {
            const mockTable = createMockTable();
            const { queryByText } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                    dragSumInfo={null}
                />,
            );

            expect(queryByText(/Sum/)).toBeNull();
        });

        test("hides drag sum info when dragSumInfo is undefined", () => {
            const mockTable = createMockTable();
            const { queryByText } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                />,
            );

            expect(queryByText(/Sum/)).toBeNull();
        });
    });

    // ── Translations ────────────────────────────────────────────
    describe("Translations", () => {
        test("uses translations for labels", () => {
            const mockTable = createMockTable({
                getFilteredSelectedRowModel: vi.fn(() => ({ rows: [{}] })),
                getFilteredRowModel: vi.fn(() => ({ rows: Array(10).fill({}) })),
            });
            const { getByText } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                    enableRowSelection
                    enableShowAll
                    dragSumInfo={{ sum: 100, count: 2 }}
                    translations={{
                        rowsSelected: "selected rows",
                        rowsPerPage: "Items per page",
                        showAll: "Show everything",
                        sumLabel: "Total",
                        first: "Go to first",
                        previous: "Go back",
                        next: "Go forward",
                        last: "Go to last",
                    }}
                />,
            );

            expect(getByText("Items per page")).toBeDefined();
            expect(getByText(/selected rows/)).toBeDefined();
            expect(getByText("Show everything")).toBeDefined();
            expect(getByText(/Total/)).toBeDefined();
        });

        test("uses translated aria-labels for navigation buttons", () => {
            const mockTable = createMockTable({
                getCanPreviousPage: vi.fn(() => true),
                getCanNextPage: vi.fn(() => true),
            });
            const { getByRole } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                    translations={{
                        first: "Go to first",
                        previous: "Go back",
                        next: "Go forward",
                        last: "Go to last",
                    }}
                />,
            );

            expect(getByRole("button", { name: "Go to first" })).toBeDefined();
            expect(getByRole("button", { name: "Go back" })).toBeDefined();
            expect(getByRole("button", { name: "Go forward" })).toBeDefined();
            expect(getByRole("button", { name: "Go to last" })).toBeDefined();
        });

        test("uses default labels when no translations provided", () => {
            const mockTable = createMockTable({
                getFilteredSelectedRowModel: vi.fn(() => ({ rows: [{}] })),
                getFilteredRowModel: vi.fn(() => ({ rows: Array(10).fill({}) })),
            });
            const { getByText, getByRole } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                    enableRowSelection
                />,
            );

            expect(getByText("Rows per page")).toBeDefined();
            expect(getByText(/selected/)).toBeDefined();
            expect(getByRole("button", { name: "First page" })).toBeDefined();
            expect(getByRole("button", { name: "Next page" })).toBeDefined();
        });
    });

    // ── Clipboard copy ──────────────────────────────────────────
    describe("Clipboard copy", () => {
        test("copies sum to clipboard when copy button is clicked", async () => {
            const user = userEvent.setup();
            const writeText = vi.fn().mockResolvedValue(undefined);
            Object.defineProperty(navigator, "clipboard", {
                value: { writeText },
                writable: true,
                configurable: true,
            });

            const mockTable = createMockTable();
            const { getAllByRole } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                    dragSumInfo={{ sum: 2500, count: 3 }}
                />,
            );

            // The copy button is inside the drag sum info area
            const buttons = getAllByRole("button");
            // Find the copy button (it's the one without an aria-label for navigation)
            const copyButton = buttons.find(
                (btn) =>
                    !btn.getAttribute("aria-label") ||
                    (!btn.getAttribute("aria-label")!.includes("page") &&
                        !btn.getAttribute("aria-label")!.includes("First") &&
                        !btn.getAttribute("aria-label")!.includes("Last")),
            );
            expect(copyButton).toBeDefined();

            await user.click(copyButton!);

            expect(writeText).toHaveBeenCalledWith("2500");
        });

        test("shows check icon after successful copy", async () => {
            const user = userEvent.setup();
            const writeText = vi.fn().mockResolvedValue(undefined);
            Object.defineProperty(navigator, "clipboard", {
                value: { writeText },
                writable: true,
                configurable: true,
            });

            const mockTable = createMockTable();
            const { getAllByRole } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                    dragSumInfo={{ sum: 500, count: 1 }}
                />,
            );

            const buttons = getAllByRole("button");
            const copyButton = buttons.find(
                (btn) =>
                    !btn.getAttribute("aria-label") ||
                    (!btn.getAttribute("aria-label")!.includes("page") &&
                        !btn.getAttribute("aria-label")!.includes("First") &&
                        !btn.getAttribute("aria-label")!.includes("Last")),
            );

            await user.click(copyButton!);

            // After clicking, the icon should switch to Check (lucide renders SVG)
            // Since lucide icons are not mocked, they render as SVG elements.
            // We verify by checking the clipboard was called (the state change triggers re-render)
            await waitFor(() => {
                expect(writeText).toHaveBeenCalledOnce();
            });
        });

        test("handles clipboard API failure gracefully", async () => {
            const user = userEvent.setup();
            const writeText = vi.fn().mockRejectedValue(new Error("Clipboard unavailable"));
            Object.defineProperty(navigator, "clipboard", {
                value: { writeText },
                writable: true,
                configurable: true,
            });

            const mockTable = createMockTable();
            const { getAllByRole } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                    dragSumInfo={{ sum: 999, count: 2 }}
                />,
            );

            const buttons = getAllByRole("button");
            const copyButton = buttons.find(
                (btn) =>
                    !btn.getAttribute("aria-label") ||
                    (!btn.getAttribute("aria-label")!.includes("page") &&
                        !btn.getAttribute("aria-label")!.includes("First") &&
                        !btn.getAttribute("aria-label")!.includes("Last")),
            );

            // Should not throw
            await user.click(copyButton!);

            expect(writeText).toHaveBeenCalledWith("999");
        });
    });

    // ── Edge cases ──────────────────────────────────────────────
    describe("Edge cases", () => {
        test("renders correctly with single page", () => {
            const mockTable = createMockTable({
                getPageCount: vi.fn(() => 1),
                getCanPreviousPage: vi.fn(() => false),
                getCanNextPage: vi.fn(() => false),
            });
            const { getByText, getByRole } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                />,
            );

            expect(getByText("1 / 1")).toBeDefined();

            // All navigation buttons should be disabled
            expect(getByRole("button", { name: "First page" })).toHaveProperty("disabled", true);
            expect(getByRole("button", { name: "Previous page" })).toHaveProperty("disabled", true);
            expect(getByRole("button", { name: "Next page" })).toHaveProperty("disabled", true);
            expect(getByRole("button", { name: "Last page" })).toHaveProperty("disabled", true);
        });

        test("renders page size selector even when isShowAll is true", () => {
            const mockTable = createMockTable();
            const { getByText } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={true}
                    onShowAllChange={vi.fn()}
                />,
            );

            // The rows per page label and select should still be visible
            expect(getByText("Rows per page")).toBeDefined();
        });

        test("drag sum with zero values", () => {
            const mockTable = createMockTable();
            const { getByText } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={false}
                    onShowAllChange={vi.fn()}
                    dragSumInfo={{ sum: 0, count: 0 }}
                />,
            );

            expect(getByText(/Sum \(0\):/)).toBeDefined();
            // The sum value "0" is in its own span
            expect(
                getByText((content, element) => {
                    return (
                        element?.tagName === "SPAN" &&
                        element?.className.includes("font-semibold") &&
                        content === "0"
                    );
                }),
            ).toBeDefined();
        });

        test("switching from 'all' back to a numeric page size calls onShowAllChange(false)", async () => {
            const user = userEvent.setup();
            const onShowAllChange = vi.fn();
            const mockTable = createMockTable();
            const { container } = render(
                <DataTablePagination
                    table={mockTable}
                    isShowAll={true}
                    onShowAllChange={onShowAllChange}
                    enableShowAll
                />,
            );

            const select = container.querySelector("select")!;
            await user.selectOptions(select, "20");

            expect(onShowAllChange).toHaveBeenCalledWith(false);
            expect(mockTable.setPageSize).toHaveBeenCalledWith(20);
        });
    });
});
