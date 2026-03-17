import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("motion/react", async () => (await import("./test-helpers")).motionMock);
vi.mock("../../ui/button.tsx", async () => (await import("./test-helpers")).buttonMock);
vi.mock("../../ui/select.tsx", async () => (await import("./test-helpers")).selectMock);
vi.mock("../../ui/dropdown-menu.tsx", async () => (await import("./test-helpers")).dropdownMenuMock);

import type { Table } from "@tanstack/react-table";
import { DataTableToolbar } from "../data-table-toolbar";

// ── Mock factories ──────────────────────────────────────────────
function createMockColumn(overrides: any = {}) {
    return {
        id: overrides.id ?? "col1",
        columnDef: {
            header: overrides.header ?? "Column 1",
            meta: overrides.meta ?? {},
        },
        getFilterValue: vi.fn(() => overrides.filterValue),
        setFilterValue: vi.fn(),
        getCanHide: vi.fn(() => overrides.canHide ?? true),
        getIsVisible: vi.fn(() => overrides.isVisible ?? true),
        toggleVisibility: vi.fn(),
    };
}

function createMockTable(columns: any[] = []) {
    return {
        getAllColumns: vi.fn(() => columns),
    } as unknown as Table<unknown>;
}

// ── Default props helper ────────────────────────────────────────
function defaultProps(overrides: any = {}) {
    return {
        table: overrides.table ?? createMockTable(),
        globalFilter: overrides.globalFilter ?? "",
        onGlobalFilterChange: overrides.onGlobalFilterChange ?? vi.fn(),
        ...overrides,
    };
}

// ── Tests ───────────────────────────────────────────────────────
describe("DataTableToolbar", () => {
    // ── Null render ─────────────────────────────────────────────
    test("returns null when no features are enabled", () => {
        const { container } = render(
            <DataTableToolbar {...defaultProps()} />,
        );
        expect(container.innerHTML).toBe("");
    });

    // ── Global search ───────────────────────────────────────────
    describe("Global search", () => {
        test("renders global search input when enableGlobalSearch is true", () => {
            const { getByPlaceholderText } = render(
                <DataTableToolbar {...defaultProps({ enableGlobalSearch: true })} />,
            );
            expect(getByPlaceholderText("Search...")).toBeDefined();
        });

        test("input value matches globalFilter prop", () => {
            const { getByDisplayValue } = render(
                <DataTableToolbar
                    {...defaultProps({ enableGlobalSearch: true, globalFilter: "hello" })}
                />,
            );
            expect(getByDisplayValue("hello")).toBeDefined();
        });

        test("typing calls onGlobalFilterChange", async () => {
            const user = userEvent.setup();
            const onGlobalFilterChange = vi.fn();
            const { getByPlaceholderText } = render(
                <DataTableToolbar
                    {...defaultProps({ enableGlobalSearch: true, onGlobalFilterChange })}
                />,
            );

            await user.type(getByPlaceholderText("Search..."), "test");

            // Each keystroke fires onChange with the single character typed
            // (the input value stays "" because globalFilter prop is controlled and stays "")
            expect(onGlobalFilterChange).toHaveBeenCalledTimes(4);
            expect(onGlobalFilterChange).toHaveBeenNthCalledWith(1, "t");
            expect(onGlobalFilterChange).toHaveBeenNthCalledWith(2, "e");
            expect(onGlobalFilterChange).toHaveBeenNthCalledWith(3, "s");
            expect(onGlobalFilterChange).toHaveBeenNthCalledWith(4, "t");
        });

        test("uses custom translations for placeholder", () => {
            const { getByPlaceholderText } = render(
                <DataTableToolbar
                    {...defaultProps({
                        enableGlobalSearch: true,
                        translations: { search: "Qidirish..." },
                    })}
                />,
            );
            expect(getByPlaceholderText("Qidirish...")).toBeDefined();
        });
    });

    // ── Text filter ─────────────────────────────────────────────
    describe("Text filter", () => {
        test("renders input for column with filterVariant='text'", () => {
            const textCol = createMockColumn({
                id: "name",
                header: "Name",
                meta: { filterVariant: "text" },
            });
            const table = createMockTable([textCol]);

            const { getByPlaceholderText } = render(
                <DataTableToolbar {...defaultProps({ table, enableFiltering: true })} />,
            );

            expect(getByPlaceholderText("Filter name...")).toBeDefined();
        });

        test("text filter input reflects current filter value", () => {
            const textCol = createMockColumn({
                id: "name",
                header: "Name",
                meta: { filterVariant: "text" },
                filterValue: "Alice",
            });
            const table = createMockTable([textCol]);

            const { getByDisplayValue } = render(
                <DataTableToolbar {...defaultProps({ table, enableFiltering: true })} />,
            );

            expect(getByDisplayValue("Alice")).toBeDefined();
        });

        test("typing in text filter calls setFilterValue", async () => {
            const user = userEvent.setup();
            const textCol = createMockColumn({
                id: "name",
                header: "Name",
                meta: { filterVariant: "text" },
            });
            const table = createMockTable([textCol]);

            const { getByPlaceholderText } = render(
                <DataTableToolbar {...defaultProps({ table, enableFiltering: true })} />,
            );

            await user.type(getByPlaceholderText("Filter name..."), "Bob");

            expect(textCol.setFilterValue).toHaveBeenCalled();
        });

        test("clearing text filter calls setFilterValue with undefined", async () => {
            const user = userEvent.setup();
            const textCol = createMockColumn({
                id: "name",
                header: "Name",
                meta: { filterVariant: "text" },
                filterValue: "Alice",
            });
            const table = createMockTable([textCol]);

            const { getByDisplayValue } = render(
                <DataTableToolbar {...defaultProps({ table, enableFiltering: true })} />,
            );

            await user.clear(getByDisplayValue("Alice"));

            expect(textCol.setFilterValue).toHaveBeenCalledWith(undefined);
        });

        test("uses custom filter translation for placeholder", () => {
            const textCol = createMockColumn({
                id: "name",
                header: "Name",
                meta: { filterVariant: "text" },
            });
            const table = createMockTable([textCol]);

            const { getByPlaceholderText } = render(
                <DataTableToolbar
                    {...defaultProps({
                        table,
                        enableFiltering: true,
                        translations: { filter: "Filtrlash" },
                    })}
                />,
            );

            expect(getByPlaceholderText("Filtrlash name...")).toBeDefined();
        });
    });

    // ── Select filter ───────────────────────────────────────────
    describe("Select filter", () => {
        test("renders select with options for filterVariant='select'", () => {
            const selectCol = createMockColumn({
                id: "status",
                header: "Status",
                meta: {
                    filterVariant: "select",
                    filterOptions: [
                        { label: "Active", value: "active" },
                        { label: "Inactive", value: "inactive" },
                    ],
                },
            });
            const table = createMockTable([selectCol]);

            const { container, getByText } = render(
                <DataTableToolbar {...defaultProps({ table, enableFiltering: true })} />,
            );

            // Mock select renders as native <select>
            const select = container.querySelector("select") as HTMLSelectElement;
            expect(select).toBeDefined();
            expect(getByText("Active")).toBeDefined();
            expect(getByText("Inactive")).toBeDefined();
        });

        test("select filter shows 'All' option with column label", () => {
            const selectCol = createMockColumn({
                id: "status",
                header: "Status",
                meta: {
                    filterVariant: "select",
                    filterOptions: [{ label: "Active", value: "active" }],
                },
            });
            const table = createMockTable([selectCol]);

            const { getByText } = render(
                <DataTableToolbar {...defaultProps({ table, enableFiltering: true })} />,
            );

            expect(getByText("Status: All")).toBeDefined();
        });

        test("selecting a value calls setFilterValue", async () => {
            const user = userEvent.setup();
            const selectCol = createMockColumn({
                id: "status",
                header: "Status",
                meta: {
                    filterVariant: "select",
                    filterOptions: [
                        { label: "Active", value: "active" },
                        { label: "Inactive", value: "inactive" },
                    ],
                },
            });
            const table = createMockTable([selectCol]);

            const { container } = render(
                <DataTableToolbar {...defaultProps({ table, enableFiltering: true })} />,
            );

            const select = container.querySelector("select") as HTMLSelectElement;
            await user.selectOptions(select, "active");

            expect(selectCol.setFilterValue).toHaveBeenCalledWith("active");
        });

        test("selecting '__all__' calls setFilterValue with undefined", async () => {
            const user = userEvent.setup();
            const selectCol = createMockColumn({
                id: "status",
                header: "Status",
                meta: {
                    filterVariant: "select",
                    filterOptions: [{ label: "Active", value: "active" }],
                },
                filterValue: "active",
            });
            const table = createMockTable([selectCol]);

            const { container } = render(
                <DataTableToolbar {...defaultProps({ table, enableFiltering: true })} />,
            );

            const select = container.querySelector("select") as HTMLSelectElement;
            await user.selectOptions(select, "__all__");

            expect(selectCol.setFilterValue).toHaveBeenCalledWith(undefined);
        });

        test("uses custom filterAll translation", () => {
            const selectCol = createMockColumn({
                id: "status",
                header: "Status",
                meta: {
                    filterVariant: "select",
                    filterOptions: [{ label: "Active", value: "active" }],
                },
            });
            const table = createMockTable([selectCol]);

            const { getByText } = render(
                <DataTableToolbar
                    {...defaultProps({
                        table,
                        enableFiltering: true,
                        translations: { filterAll: "Hammasi" },
                    })}
                />,
            );

            expect(getByText("Status: Hammasi")).toBeDefined();
        });
    });

    // ── Range filter ────────────────────────────────────────────
    describe("Range filter", () => {
        test("renders min/max inputs for filterVariant='range'", () => {
            const rangeCol = createMockColumn({
                id: "price",
                header: "Price",
                meta: { filterVariant: "range" },
            });
            const table = createMockTable([rangeCol]);

            const { getByPlaceholderText } = render(
                <DataTableToolbar {...defaultProps({ table, enableFiltering: true })} />,
            );

            expect(getByPlaceholderText("Price min")).toBeDefined();
            expect(getByPlaceholderText("max")).toBeDefined();
        });

        test("typing in range min input calls setFilterValue", async () => {
            const user = userEvent.setup();
            const rangeCol = createMockColumn({
                id: "price",
                header: "Price",
                meta: { filterVariant: "range" },
            });
            const table = createMockTable([rangeCol]);

            const { getByPlaceholderText } = render(
                <DataTableToolbar {...defaultProps({ table, enableFiltering: true })} />,
            );

            await user.type(getByPlaceholderText("Price min"), "10");

            expect(rangeCol.setFilterValue).toHaveBeenCalled();
        });

        test("typing in range max input calls setFilterValue", async () => {
            const user = userEvent.setup();
            const rangeCol = createMockColumn({
                id: "price",
                header: "Price",
                meta: { filterVariant: "range" },
            });
            const table = createMockTable([rangeCol]);

            const { getByPlaceholderText } = render(
                <DataTableToolbar {...defaultProps({ table, enableFiltering: true })} />,
            );

            await user.type(getByPlaceholderText("max"), "100");

            expect(rangeCol.setFilterValue).toHaveBeenCalled();
        });

        test("uses custom filterMin and filterMax translations", () => {
            const rangeCol = createMockColumn({
                id: "price",
                header: "Price",
                meta: { filterVariant: "range" },
            });
            const table = createMockTable([rangeCol]);

            const { getByPlaceholderText } = render(
                <DataTableToolbar
                    {...defaultProps({
                        table,
                        enableFiltering: true,
                        translations: { filterMin: "dan", filterMax: "gacha" },
                    })}
                />,
            );

            expect(getByPlaceholderText("Price dan")).toBeDefined();
            expect(getByPlaceholderText("gacha")).toBeDefined();
        });
    });

    // ── Clear filters ───────────────────────────────────────────
    describe("Clear filters button", () => {
        test("appears when filters are active", () => {
            const activeCol = createMockColumn({
                id: "name",
                header: "Name",
                meta: { filterVariant: "text" },
                filterValue: "Alice",
            });
            const table = createMockTable([activeCol]);

            const { container } = render(
                <DataTableToolbar {...defaultProps({ table, enableFiltering: true })} />,
            );

            // The clear button contains an X icon rendered as <svg> by lucide-react
            const buttons = container.querySelectorAll("button");
            // There should be at least one button for clearing filters
            const clearButton = Array.from(buttons).find(
                (btn) => btn.querySelector("svg") || btn.textContent === "",
            );
            expect(clearButton).toBeDefined();
        });

        test("does not appear when no filters are active", () => {
            const inactiveCol = createMockColumn({
                id: "name",
                header: "Name",
                meta: { filterVariant: "text" },
                // filterValue is undefined by default
            });
            const table = createMockTable([inactiveCol]);

            const { container } = render(
                <DataTableToolbar {...defaultProps({ table, enableFiltering: true })} />,
            );

            // Only the filter input should be present, no clear button with svg
            const buttons = container.querySelectorAll("button");
            const clearButton = Array.from(buttons).find(
                (btn) => btn.querySelector("svg"),
            );
            expect(clearButton).toBeUndefined();
        });

        test("resets all filter columns when clicked", async () => {
            const user = userEvent.setup();
            const col1 = createMockColumn({
                id: "name",
                header: "Name",
                meta: { filterVariant: "text" },
                filterValue: "Alice",
            });
            const col2 = createMockColumn({
                id: "status",
                header: "Status",
                meta: {
                    filterVariant: "select",
                    filterOptions: [{ label: "Active", value: "active" }],
                },
                filterValue: "active",
            });
            const table = createMockTable([col1, col2]);

            const { container } = render(
                <DataTableToolbar {...defaultProps({ table, enableFiltering: true })} />,
            );

            const buttons = container.querySelectorAll("button");
            const clearButton = Array.from(buttons).find(
                (btn) => btn.querySelector("svg"),
            );
            expect(clearButton).toBeDefined();
            await user.click(clearButton!);

            expect(col1.setFilterValue).toHaveBeenCalledWith(undefined);
            expect(col2.setFilterValue).toHaveBeenCalledWith(undefined);
        });
    });

    // ── Column visibility ───────────────────────────────────────
    describe("Column visibility", () => {
        test("dropdown shows when enableColumnVisibility is true", () => {
            const col1 = createMockColumn({ id: "name", header: "Name" });
            const col2 = createMockColumn({ id: "age", header: "Age" });
            const table = createMockTable([col1, col2]);

            const { getAllByText } = render(
                <DataTableToolbar {...defaultProps({ table, enableColumnVisibility: true })} />,
            );

            // "Columns" appears in both the trigger button and the dropdown label
            expect(getAllByText("Columns").length).toBe(2);
        });

        test("dropdown does not show when enableColumnVisibility is false", () => {
            const table = createMockTable([]);

            const { queryByText } = render(
                <DataTableToolbar {...defaultProps({ table, enableGlobalSearch: true })} />,
            );

            expect(queryByText("Columns")).toBeNull();
        });

        test("dropdown shows column names for hideable columns", () => {
            const col1 = createMockColumn({ id: "name", header: "Name", canHide: true });
            const col2 = createMockColumn({ id: "age", header: "Age", canHide: true });
            const col3 = createMockColumn({ id: "id", header: "ID", canHide: false });
            const table = createMockTable([col1, col2, col3]);

            const { getAllByText, queryByText } = render(
                <DataTableToolbar {...defaultProps({ table, enableColumnVisibility: true })} />,
            );

            // The dropdown mock renders children immediately, so column names are visible
            // "Name" and "Age" appear both in the dropdown label area
            const nameElements = getAllByText("Name");
            const ageElements = getAllByText("Age");
            expect(nameElements.length).toBeGreaterThan(0);
            expect(ageElements.length).toBeGreaterThan(0);

            // "ID" column has canHide=false so it should not appear in the visibility dropdown
            // The dropdown label "Columns" contains text, but "ID" should not be in a button inside dropdown
            const idButtons = queryByText("ID");
            // id column is filtered out of the dropdown
            expect(idButtons).toBeNull();
        });

        test("clicking column visibility item toggles visibility", async () => {
            const user = userEvent.setup();
            const col1 = createMockColumn({
                id: "name",
                header: "Name",
                canHide: true,
                isVisible: true,
            });
            const table = createMockTable([col1]);

            const { getAllByText } = render(
                <DataTableToolbar {...defaultProps({ table, enableColumnVisibility: true })} />,
            );

            // The DropdownMenuItem mock renders as a <button type="button"> with the column name.
            // The trigger button also contains "Columns" text, not "Name", so we just need to find
            // the <button type="button"> which is the dropdown item.
            const nameElements = getAllByText("Name");
            const dropdownItem = nameElements.find(
                (el) => el.tagName.toLowerCase() === "button" && el.getAttribute("type") === "button",
            )!;
            await user.click(dropdownItem);

            // toggleVisibility is called with the inverse of current visibility
            expect(col1.toggleVisibility).toHaveBeenCalledWith(false);
        });

        test("uses custom columns translation", () => {
            const table = createMockTable([
                createMockColumn({ id: "name", header: "Name" }),
            ]);

            const { getAllByText } = render(
                <DataTableToolbar
                    {...defaultProps({
                        table,
                        enableColumnVisibility: true,
                        translations: { columns: "Ustunlar" },
                    })}
                />,
            );

            // Both the trigger button and the dropdown label show the translation
            const ustunlarElements = getAllByText("Ustunlar");
            expect(ustunlarElements.length).toBe(2);
        });

        test("visible column shows full opacity checkmark", () => {
            const col = createMockColumn({
                id: "name",
                header: "Name",
                canHide: true,
                isVisible: true,
            });
            const table = createMockTable([col]);

            const { container } = render(
                <DataTableToolbar {...defaultProps({ table, enableColumnVisibility: true })} />,
            );

            const checkmark = container.querySelector(".opacity-100");
            expect(checkmark).toBeDefined();
            expect(checkmark?.textContent).toContain("\u2713");
        });

        test("hidden column shows reduced opacity checkmark", () => {
            const col = createMockColumn({
                id: "name",
                header: "Name",
                canHide: true,
                isVisible: false,
            });
            const table = createMockTable([col]);

            const { container } = render(
                <DataTableToolbar {...defaultProps({ table, enableColumnVisibility: true })} />,
            );

            const checkmark = container.querySelector(".opacity-30");
            expect(checkmark).toBeDefined();
            expect(checkmark?.textContent).toContain("\u2713");
        });
    });

    // ── Edge cases ──────────────────────────────────────────────
    describe("Edge cases", () => {
        test("columns without filterVariant are excluded from filter columns", () => {
            const noFilterCol = createMockColumn({
                id: "name",
                header: "Name",
                meta: {},
            });
            const withFilterCol = createMockColumn({
                id: "status",
                header: "Status",
                meta: { filterVariant: "text" },
            });
            const table = createMockTable([noFilterCol, withFilterCol]);

            const { container } = render(
                <DataTableToolbar {...defaultProps({ table, enableFiltering: true })} />,
            );

            // Only one filter input should appear (for status), not for name
            const inputs = container.querySelectorAll("input");
            expect(inputs.length).toBe(1);
        });

        test("getColumnLabel falls back to column id when header is not a string", () => {
            const col = createMockColumn({
                id: "customCol",
                header: () => "Rendered Header", // function header
                canHide: true,
            });
            const table = createMockTable([col]);

            const { getByText } = render(
                <DataTableToolbar {...defaultProps({ table, enableColumnVisibility: true })} />,
            );

            // Should display column.id as fallback
            expect(getByText("customCol")).toBeDefined();
        });

        test("multiple features can be enabled simultaneously", () => {
            const filterCol = createMockColumn({
                id: "status",
                header: "Status",
                meta: {
                    filterVariant: "select",
                    filterOptions: [{ label: "Active", value: "active" }],
                },
            });
            const hidableCol = createMockColumn({
                id: "name",
                header: "Name",
                canHide: true,
            });
            const table = createMockTable([filterCol, hidableCol]);

            const { getByPlaceholderText, getAllByText, container } = render(
                <DataTableToolbar
                    {...defaultProps({
                        table,
                        enableGlobalSearch: true,
                        enableFiltering: true,
                        enableColumnVisibility: true,
                    })}
                />,
            );

            // Global search
            expect(getByPlaceholderText("Search...")).toBeDefined();
            // Filter select
            expect(container.querySelector("select")).toBeDefined();
            // Column visibility dropdown (trigger button + dropdown label both say "Columns")
            expect(getAllByText("Columns").length).toBeGreaterThanOrEqual(1);
        });

        test("enableFiltering with no filter columns renders no filter controls", () => {
            const col = createMockColumn({
                id: "name",
                header: "Name",
                meta: {},
            });
            const table = createMockTable([col]);

            const { container } = render(
                <DataTableToolbar
                    {...defaultProps({
                        table,
                        enableFiltering: true,
                        enableGlobalSearch: true,
                    })}
                />,
            );

            // Only the global search input, no filter-specific inputs
            const inputs = container.querySelectorAll("input");
            expect(inputs.length).toBe(1);
        });
    });
});
