import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useCellNavigation } from "../use-cell-navigation";

import type * as React from "react";

// ── DOM helpers ──────────────────────────────────────────────────
interface CellSpec {
    row: number;
    col: string;
    /** Whether to render an input/combobox inside the cell */
    input?:
        | "text"
        | "combobox-open-no-value"
        | "combobox-closed-no-value"
        | "combobox-closed-with-value";
    skipOnEnter?: boolean;
}

/**
 * Build a table DOM fragment with cells matching the given specs. The returned
 * container can be used as the containerRef target for useCellNavigation.
 */
function buildTable(cells: CellSpec[]): HTMLDivElement {
    const container = document.createElement("div");
    const table = document.createElement("table");
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);
    container.appendChild(table);

    // Group cells by row
    const byRow = new Map<number, CellSpec[]>();
    for (const c of cells) {
        if (!byRow.has(c.row)) byRow.set(c.row, []);
        byRow.get(c.row)!.push(c);
    }

    for (const [rowIdx, rowCells] of Array.from(byRow.entries()).sort(([a], [b]) => a - b)) {
        const tr = document.createElement("tr");
        tr.setAttribute("data-row-id", `__new_row_${rowIdx}`);
        for (const spec of rowCells) {
            const td = document.createElement("td");
            td.setAttribute("data-row-index", String(spec.row));
            td.setAttribute("data-column-id", spec.col);
            td.setAttribute("tabindex", "-1");
            if (spec.skipOnEnter) td.setAttribute("data-skip-on-enter", "true");
            if (spec.input) {
                const input = document.createElement("input");
                if (spec.input === "text") {
                    input.type = "text";
                } else {
                    input.setAttribute("role", "combobox");
                    if (spec.input === "combobox-open-no-value") {
                        input.setAttribute("aria-expanded", "true");
                    } else {
                        input.setAttribute("aria-expanded", "false");
                    }
                    if (spec.input === "combobox-closed-with-value") {
                        input.value = "ru";
                    }
                }
                td.appendChild(input);
            }
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }

    document.body.appendChild(container);
    return container;
}

function dispatchKey(el: Element, key: string, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...init,
    });
    el.dispatchEvent(event);
    return event;
}

// ── Tests ────────────────────────────────────────────────────────
describe("useCellNavigation — Enter key", () => {
    let container: HTMLDivElement | null = null;

    beforeEach(() => {
        document.body.innerHTML = "";
    });

    afterEach(() => {
        if (container) container.remove();
        container = null;
    });

    /** Mount the hook with a container pointing at the given element */
    function mount(el: HTMLElement) {
        renderHook(() =>
            useCellNavigation({
                enabled: true,
                containerRef: { current: el } as React.RefObject<HTMLElement | null>,
            }),
        );
    }

    test("Enter on focused input advances to next enter-cell", () => {
        container = buildTable([
            { row: 0, col: "name", input: "text" },
            { row: 0, col: "language", input: "combobox-closed-with-value" },
            { row: 1, col: "name", input: "text" },
            { row: 1, col: "language", input: "combobox-closed-no-value" },
        ]);
        mount(container);

        const combobox = container.querySelector<HTMLInputElement>(
            'td[data-row-index="0"][data-column-id="language"] [role="combobox"]',
        )!;

        const focusSpy = vi.fn();
        const nextInput = container.querySelector<HTMLInputElement>(
            'td[data-row-index="1"][data-column-id="name"] input',
        )!;
        nextInput.addEventListener("focus", focusSpy);

        const ev = dispatchKey(combobox, "Enter");

        expect(ev.defaultPrevented).toBe(true);
        expect(focusSpy).toHaveBeenCalled();
    });

    test("Enter on td (cursor mode) with closed combobox WITHOUT value enters edit mode", () => {
        container = buildTable([
            { row: 0, col: "name", input: "text" },
            { row: 0, col: "language", input: "combobox-closed-no-value" },
            { row: 1, col: "name", input: "text" },
        ]);
        mount(container);

        const comboboxTd = container.querySelector<HTMLElement>(
            'td[data-row-index="0"][data-column-id="language"]',
        )!;
        const combobox = comboboxTd.querySelector<HTMLInputElement>('[role="combobox"]')!;

        const listener = vi.fn();
        container.addEventListener("datatable:request-append-row", listener as EventListener);

        // Dispatch Enter from the td itself (cursor mode) — target.tagName is "TD",
        // so the handler's `input` is null. Without value, the handler should
        // enter edit mode (focusCell(td, true)), not request-append-row.
        const focusSpy = vi.fn();
        combobox.addEventListener("focus", focusSpy);

        const ev = dispatchKey(comboboxTd, "Enter");

        expect(ev.defaultPrevented).toBe(true);
        expect(listener).not.toHaveBeenCalled();
        // focusCell in edit mode → combobox input gets focus
        expect(focusSpy).toHaveBeenCalled();
    });

    test("Enter on td (cursor mode) with closed combobox WITH value advances to next enter-cell", () => {
        container = buildTable([
            { row: 0, col: "name", input: "text" },
            { row: 0, col: "language", input: "combobox-closed-with-value" },
            { row: 1, col: "name", input: "text" },
            { row: 1, col: "language", input: "combobox-closed-no-value" },
        ]);
        mount(container);

        const comboboxTd = container.querySelector<HTMLElement>(
            'td[data-row-index="0"][data-column-id="language"]',
        )!;
        const nextInput = container.querySelector<HTMLInputElement>(
            'td[data-row-index="1"][data-column-id="name"] input',
        )!;

        const focusSpy = vi.fn();
        nextInput.addEventListener("focus", focusSpy);

        const ev = dispatchKey(comboboxTd, "Enter");

        expect(ev.defaultPrevented).toBe(true);
        expect(focusSpy).toHaveBeenCalled();
    });

    test("Enter in last enter-cell (plain input) dispatches datatable:request-append-row", () => {
        container = buildTable([
            { row: 0, col: "name", input: "text" },
            { row: 1, col: "name", input: "text" },
        ]);
        mount(container);

        const lastInput = container.querySelector<HTMLInputElement>(
            'td[data-row-index="1"][data-column-id="name"] input',
        )!;

        const listener = vi.fn();
        container.addEventListener("datatable:request-append-row", listener as EventListener);

        lastInput.focus();
        dispatchKey(lastInput, "Enter");

        expect(listener).toHaveBeenCalledTimes(1);
        const event = listener.mock.calls[0][0] as CustomEvent<{
            fromRow: number;
            fromCol: string;
        }>;
        expect(event.detail).toEqual({ fromRow: 1, fromCol: "name" });
    });

    test("Enter in last cell when it is a closed combobox with value dispatches request-append-row", () => {
        container = buildTable([
            { row: 0, col: "name", input: "text" },
            { row: 0, col: "language", input: "combobox-closed-with-value" },
        ]);
        mount(container);

        const combobox = container.querySelector<HTMLInputElement>(
            'td[data-row-index="0"][data-column-id="language"] [role="combobox"]',
        )!;

        const listener = vi.fn();
        container.addEventListener("datatable:request-append-row", listener as EventListener);

        const ev = dispatchKey(combobox, "Enter");

        expect(ev.defaultPrevented).toBe(true);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test("Enter advances from last enter-cell (before appending) without calling blur", () => {
        container = buildTable([{ row: 0, col: "name", input: "text" }]);
        mount(container);

        const input = container.querySelector<HTMLInputElement>(
            'td[data-row-index="0"][data-column-id="name"] input',
        )!;

        const blurSpy = vi.spyOn(input, "blur");
        const listener = vi.fn();
        container.addEventListener("datatable:request-append-row", listener as EventListener);

        input.focus();
        dispatchKey(input, "Enter");

        expect(listener).toHaveBeenCalledTimes(1);
        expect(blurSpy).not.toHaveBeenCalled();
    });

    test("Enter on open combobox does not interfere (bails out)", () => {
        container = buildTable([
            { row: 0, col: "language", input: "combobox-open-no-value" },
            { row: 1, col: "language", input: "combobox-closed-no-value" },
        ]);
        mount(container);

        const combobox = container.querySelector<HTMLInputElement>(
            'td[data-row-index="0"][data-column-id="language"] [role="combobox"]',
        )!;

        const listener = vi.fn();
        container.addEventListener("datatable:request-append-row", listener as EventListener);

        const ev = dispatchKey(combobox, "Enter");

        // Open combobox → handler bails, no preventDefault, no request event
        expect(ev.defaultPrevented).toBe(false);
        expect(listener).not.toHaveBeenCalled();
    });
});
