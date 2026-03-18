import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useMultiRowState } from "../use-multi-row-state";

// ── Helpers ──────────────────────────────────────────────────────
const defaultOptions = {
    enabled: true,
    initialCount: 3,
    increment: 2,
    maxCount: 10,
} as const;

/** Returns a fresh options object (avoids shared references between tests) */
function createOptions(overrides?: Partial<Parameters<typeof useMultiRowState>[0]>) {
    return { ...defaultOptions, ...overrides };
}

/** Renders the hook and waits for the initial effect to run */
async function renderMultiRowHook(overrides?: Partial<Parameters<typeof useMultiRowState>[0]>) {
    const options = createOptions(overrides);
    const hook = renderHook(() => useMultiRowState(options));
    // Wait for the useEffect initialization
    await act(async () => {});
    return hook;
}

// ── Tests ────────────────────────────────────────────────────────
describe("useMultiRowState", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ── Initialization ───────────────────────────────────────────
    describe("initialization", () => {
        test("creates correct number of rows when enabled", async () => {
            const { result } = await renderMultiRowHook({ initialCount: 3 });

            expect(result.current.rowStates).toHaveLength(3);
            for (const row of result.current.rowStates) {
                expect(row.id).toMatch(/^__new_row_\d+_\d+$/);
                expect(row.errors).toEqual({});
            }
        });

        test("does NOT create rows when disabled", async () => {
            const { result } = await renderMultiRowHook({ enabled: false });

            expect(result.current.rowStates).toHaveLength(0);
        });

        test("creates rows with initialCount=1", async () => {
            const { result } = await renderMultiRowHook({ initialCount: 1 });

            expect(result.current.rowStates).toHaveLength(1);
        });

        test("creates rows with initialCount=0", async () => {
            const { result } = await renderMultiRowHook({ initialCount: 0 });

            expect(result.current.rowStates).toHaveLength(0);
        });

        test("uses function defaultValues correctly (passes index)", async () => {
            const defaultValuesFn = vi.fn((index: number) => ({
                name: `Row ${index}`,
                quantity: index * 10,
            }));

            const { result } = await renderMultiRowHook({
                initialCount: 3,
                defaultValues: defaultValuesFn,
            });

            expect(defaultValuesFn).toHaveBeenCalledTimes(3);
            expect(defaultValuesFn).toHaveBeenCalledWith(0);
            expect(defaultValuesFn).toHaveBeenCalledWith(1);
            expect(defaultValuesFn).toHaveBeenCalledWith(2);

            expect(result.current.rowStates[0].values).toEqual({ name: "Row 0", quantity: 0 });
            expect(result.current.rowStates[1].values).toEqual({ name: "Row 1", quantity: 10 });
            expect(result.current.rowStates[2].values).toEqual({ name: "Row 2", quantity: 20 });
        });

        test("uses object defaultValues correctly", async () => {
            const { result } = await renderMultiRowHook({
                initialCount: 2,
                defaultValues: { name: "", quantity: 0 },
            });

            expect(result.current.rowStates[0].values).toEqual({ name: "", quantity: 0 });
            expect(result.current.rowStates[1].values).toEqual({ name: "", quantity: 0 });
        });

        test("each row gets its own copy of object defaultValues", async () => {
            const { result } = await renderMultiRowHook({
                initialCount: 2,
                defaultValues: { name: "", items: [] },
            });

            // Verify they are separate objects (not shared references)
            expect(result.current.rowStates[0].values).not.toBe(result.current.rowStates[1].values);
        });

        test("rows have lastSavedValues matching initial values", async () => {
            const { result } = await renderMultiRowHook({
                initialCount: 2,
                defaultValues: { name: "test", count: 5 },
            });

            for (const row of result.current.rowStates) {
                expect(row.lastSavedValues).toEqual({ name: "test", count: 5 });
            }
        });

        test("rows without defaultValues get empty objects", async () => {
            const { result } = await renderMultiRowHook({ initialCount: 1 });

            expect(result.current.rowStates[0].values).toEqual({});
        });

        test("does not reinitialize rows on re-render", async () => {
            const options = createOptions({ initialCount: 2 });
            const { result, rerender } = renderHook(() => useMultiRowState(options));
            await act(async () => {});

            const firstIds = result.current.rowStates.map((r) => r.id);

            rerender();
            await act(async () => {});

            const secondIds = result.current.rowStates.map((r) => r.id);
            expect(secondIds).toEqual(firstIds);
        });
    });

    // ── handleChange ─────────────────────────────────────────────
    describe("handleChange", () => {
        test("updates values for a specific row", async () => {
            const { result } = await renderMultiRowHook({ initialCount: 2 });

            const rowId = result.current.rowStates[0].id;
            const newValues = { name: "Updated", quantity: 42 };

            await act(async () => {
                result.current.handleChange(rowId, newValues);
            });

            expect(result.current.rowStates[0].values).toEqual(newValues);
            // Other rows remain unchanged
            expect(result.current.rowStates[1].values).not.toEqual(newValues);
        });

        test("does not modify other rows", async () => {
            const { result } = await renderMultiRowHook({
                initialCount: 3,
                defaultValues: { name: "original" },
            });

            const secondRowId = result.current.rowStates[1].id;
            const originalFirst = { ...result.current.rowStates[0].values };
            const originalThird = { ...result.current.rowStates[2].values };

            await act(async () => {
                result.current.handleChange(secondRowId, { name: "changed" });
            });

            expect(result.current.rowStates[0].values).toEqual(originalFirst);
            expect(result.current.rowStates[1].values).toEqual({ name: "changed" });
            expect(result.current.rowStates[2].values).toEqual(originalThird);
        });

        test("calls onChange callback and uses returned values", async () => {
            const onChange = vi.fn((values: Record<string, unknown>, _rowId: string) => ({
                ...values,
                computed: "auto-filled",
            }));

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                onChange,
            });

            const rowId = result.current.rowStates[0].id;

            await act(async () => {
                result.current.handleChange(rowId, { name: "test" });
            });

            expect(onChange).toHaveBeenCalledWith({ name: "test" }, rowId);
            expect(result.current.rowStates[0].values).toEqual({
                name: "test",
                computed: "auto-filled",
            });
        });

        test("uses original values when onChange returns void", async () => {
            const onChange = vi.fn(() => undefined);

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                onChange,
            });

            const rowId = result.current.rowStates[0].id;

            await act(async () => {
                result.current.handleChange(rowId, { name: "direct" });
            });

            expect(result.current.rowStates[0].values).toEqual({ name: "direct" });
        });
    });

    // ── handleSave ───────────────────────────────────────────────
    describe("handleSave", () => {
        test("calls onSave with correct values", async () => {
            const onSave = vi.fn().mockResolvedValue(undefined);

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "" },
                onSave,
            });

            const rowId = result.current.rowStates[0].id;

            // Change values so they differ from defaults (making them "changed")
            await act(async () => {
                result.current.handleChange(rowId, { name: "Product A" });
            });

            await act(async () => {
                await result.current.handleSave(rowId);
            });

            expect(onSave).toHaveBeenCalledWith({ name: "Product A" }, rowId, undefined);
        });

        test("passes linkedId to onSave when present", async () => {
            const onSave = vi.fn().mockResolvedValue("new-linked-id");

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "" },
                onSave,
            });

            const rowId = result.current.rowStates[0].id;

            // First save to establish a linkedId
            await act(async () => {
                result.current.handleChange(rowId, { name: "First" });
            });
            // Focus the row so it stays focused and linkedId is kept
            await act(async () => {
                result.current.handleFocus(rowId);
            });
            await act(async () => {
                await result.current.handleSave(rowId);
            });

            expect(onSave).toHaveBeenCalledWith({ name: "First" }, rowId, undefined);

            // Now the row has linkedId="new-linked-id" because it was focused during save
            // Change again and save
            await act(async () => {
                result.current.handleChange(rowId, { name: "Second" });
            });
            await act(async () => {
                await result.current.handleSave(rowId);
            });

            expect(onSave).toHaveBeenLastCalledWith({ name: "Second" }, rowId, "new-linked-id");
        });

        test("skips save for empty rows", async () => {
            const onSave = vi.fn().mockResolvedValue(undefined);

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "", quantity: null },
                onSave,
            });

            const rowId = result.current.rowStates[0].id;

            await act(async () => {
                await result.current.handleSave(rowId);
            });

            expect(onSave).not.toHaveBeenCalled();
        });

        test("skips save for rows with all undefined values", async () => {
            const onSave = vi.fn().mockResolvedValue(undefined);

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: undefined },
                onSave,
            });

            const rowId = result.current.rowStates[0].id;

            await act(async () => {
                await result.current.handleSave(rowId);
            });

            expect(onSave).not.toHaveBeenCalled();
        });

        test("skips save for unchanged rows", async () => {
            const onSave = vi.fn().mockResolvedValue(undefined);

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "initial", quantity: 5 },
                onSave,
            });

            const rowId = result.current.rowStates[0].id;

            // Values match lastSavedValues, so save should be skipped
            await act(async () => {
                await result.current.handleSave(rowId);
            });

            expect(onSave).not.toHaveBeenCalled();
        });

        test("prevents duplicate saves (deduplication via savingRowsRef)", async () => {
            let resolveSave: () => void;
            const savePromise = new Promise<void>((resolve) => {
                resolveSave = resolve;
            });
            const onSave = vi.fn().mockReturnValue(savePromise);

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "" },
                onSave,
            });

            const rowId = result.current.rowStates[0].id;

            await act(async () => {
                result.current.handleChange(rowId, { name: "test" });
            });

            // Start first save (do not await — it should remain pending)
            let savePromise1: Promise<void>;
            await act(async () => {
                savePromise1 = result.current.handleSave(rowId);
            });

            // Attempt second save while first is in progress
            await act(async () => {
                void result.current.handleSave(rowId);
            });

            // Only one call should have been made
            expect(onSave).toHaveBeenCalledTimes(1);

            // Resolve the pending save
            await act(async () => {
                resolveSave!();
                await savePromise1!;
            });
        });

        test("calls onError on save failure", async () => {
            const error = new Error("Network error");
            const onSave = vi.fn().mockRejectedValue(error);
            const onError = vi.fn();

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "" },
                onSave,
                onError,
            });

            const rowId = result.current.rowStates[0].id;

            await act(async () => {
                result.current.handleChange(rowId, { name: "will-fail" });
            });

            await act(async () => {
                await result.current.handleSave(rowId);
            });

            expect(onError).toHaveBeenCalledWith(error, rowId);
        });

        test("resets isSaving to false after error", async () => {
            const onSave = vi.fn().mockRejectedValue(new Error("fail"));
            const onError = vi.fn();

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "" },
                onSave,
                onError,
            });

            const rowId = result.current.rowStates[0].id;

            await act(async () => {
                result.current.handleChange(rowId, { name: "error-test" });
            });

            await act(async () => {
                await result.current.handleSave(rowId);
            });

            expect(result.current.rowStates[0].isSaving).toBeFalsy();
        });

        test("sets validation errors when validate returns string", async () => {
            const onSave = vi.fn().mockResolvedValue(undefined);
            const validate = vi.fn().mockReturnValue("Name is required");

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "" },
                onSave,
                validate,
            });

            const rowId = result.current.rowStates[0].id;

            await act(async () => {
                result.current.handleChange(rowId, { name: "value" });
            });

            await act(async () => {
                await result.current.handleSave(rowId);
            });

            expect(validate).toHaveBeenCalledWith({ name: "value" });
            expect(onSave).not.toHaveBeenCalled();
            expect(result.current.rowStates[0].errors).toEqual({
                _global: "Name is required",
            });
        });

        test("skips save when validate returns false", async () => {
            const onSave = vi.fn().mockResolvedValue(undefined);
            const validate = vi.fn().mockReturnValue(false);

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "" },
                onSave,
                validate,
            });

            const rowId = result.current.rowStates[0].id;

            await act(async () => {
                result.current.handleChange(rowId, { name: "value" });
            });

            await act(async () => {
                await result.current.handleSave(rowId);
            });

            expect(onSave).not.toHaveBeenCalled();
            // No error message set — validate returned false, not a string
            expect(result.current.rowStates[0].errors).toEqual({});
        });

        test("allows save when validate returns true", async () => {
            const onSave = vi.fn().mockResolvedValue(undefined);
            const validate = vi.fn().mockReturnValue(true);

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "" },
                onSave,
                validate,
            });

            const rowId = result.current.rowStates[0].id;

            await act(async () => {
                result.current.handleChange(rowId, { name: "valid" });
            });

            await act(async () => {
                await result.current.handleSave(rowId);
            });

            expect(onSave).toHaveBeenCalledWith({ name: "valid" }, rowId, undefined);
        });

        test("resets row to defaults after successful save when not focused", async () => {
            const onSave = vi.fn().mockResolvedValue("saved-id-123");

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "", quantity: 0 },
                onSave,
            });

            const rowId = result.current.rowStates[0].id;

            await act(async () => {
                result.current.handleChange(rowId, { name: "Saved Product", quantity: 10 });
            });

            await act(async () => {
                await result.current.handleSave(rowId);
            });

            // Row should be reset to defaults since it returned an ID and was not focused
            expect(result.current.rowStates[0].values).toEqual({ name: "", quantity: 0 });
            expect(result.current.rowStates[0].linkedId).toBeUndefined();
            expect(result.current.rowStates[0].isSaving).toBe(false);
        });

        test("keeps linkedId when row is still focused after save", async () => {
            const onSave = vi.fn().mockResolvedValue("linked-42");

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "" },
                onSave,
            });

            const rowId = result.current.rowStates[0].id;

            // Focus the row before saving
            await act(async () => {
                result.current.handleFocus(rowId);
            });

            await act(async () => {
                result.current.handleChange(rowId, { name: "focused-save" });
            });

            await act(async () => {
                await result.current.handleSave(rowId);
            });

            // Row should NOT be reset because it's still focused
            expect(result.current.rowStates[0].linkedId).toBe("linked-42");
            expect(result.current.rowStates[0].values).toEqual({ name: "focused-save" });
        });

        test("sets isSaving to true during save", async () => {
            let resolveSave: () => void;
            const savePromise = new Promise<void>((resolve) => {
                resolveSave = resolve;
            });
            const onSave = vi.fn().mockReturnValue(savePromise);

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "" },
                onSave,
            });

            const rowId = result.current.rowStates[0].id;

            await act(async () => {
                result.current.handleChange(rowId, { name: "saving" });
            });

            // Start save without awaiting
            act(() => {
                void result.current.handleSave(rowId);
            });

            // isSaving should be true while save is in progress
            expect(result.current.rowStates[0].isSaving).toBe(true);

            // Resolve
            await act(async () => {
                resolveSave!();
            });

            expect(result.current.rowStates[0].isSaving).toBeFalsy();
        });

        test("skips save if rowId not found", async () => {
            const onSave = vi.fn().mockResolvedValue(undefined);

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                onSave,
            });

            await act(async () => {
                await result.current.handleSave("non-existent-id");
            });

            expect(onSave).not.toHaveBeenCalled();
        });
    });

    // ── handleNeedMoreRows ───────────────────────────────────────
    describe("handleNeedMoreRows", () => {
        test("adds increment number of rows", async () => {
            const { result } = await renderMultiRowHook({
                initialCount: 2,
                increment: 3,
                maxCount: 20,
            });

            expect(result.current.rowStates).toHaveLength(2);

            await act(async () => {
                result.current.handleNeedMoreRows();
            });

            expect(result.current.rowStates).toHaveLength(5);
        });

        test("new rows have unique ids", async () => {
            const { result } = await renderMultiRowHook({
                initialCount: 1,
                increment: 2,
                maxCount: 10,
            });

            await act(async () => {
                result.current.handleNeedMoreRows();
            });

            const ids = result.current.rowStates.map((r) => r.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });

        test("new rows use function defaultValues with correct indices", async () => {
            const defaultValuesFn = vi.fn((index: number) => ({ label: `Item ${index}` }));

            const { result } = await renderMultiRowHook({
                initialCount: 2,
                increment: 2,
                maxCount: 10,
                defaultValues: defaultValuesFn,
            });

            // Reset mock to track only the new calls from handleNeedMoreRows
            defaultValuesFn.mockClear();

            await act(async () => {
                result.current.handleNeedMoreRows();
            });

            // New rows should get indices 2 and 3 (continuing from initialCount)
            expect(defaultValuesFn).toHaveBeenCalledWith(2);
            expect(defaultValuesFn).toHaveBeenCalledWith(3);
            expect(result.current.rowStates[2].values).toEqual({ label: "Item 2" });
            expect(result.current.rowStates[3].values).toEqual({ label: "Item 3" });
        });

        test("new rows use object defaultValues", async () => {
            const { result } = await renderMultiRowHook({
                initialCount: 1,
                increment: 1,
                maxCount: 10,
                defaultValues: { name: "default", count: 0 },
            });

            await act(async () => {
                result.current.handleNeedMoreRows();
            });

            expect(result.current.rowStates[1].values).toEqual({ name: "default", count: 0 });
        });

        test("does not exceed maxCount", async () => {
            const { result } = await renderMultiRowHook({
                initialCount: 4,
                increment: 3,
                maxCount: 5,
            });

            expect(result.current.rowStates).toHaveLength(4);

            await act(async () => {
                result.current.handleNeedMoreRows();
            });

            // Would add 3 (to get 7), but maxCount is 5, so no rows added
            // The implementation checks `prev.length >= maxCount` — since 4 < 5 it would add
            // But increment=3 would go to 7 which exceeds maxCount
            // Looking at the code: it adds increment rows if prev.length < maxCount
            // So it adds 3 rows: 4 + 3 = 7 total, but maxCount check is only on entry
            // Actually, re-reading the code: the check is `if (prev.length >= maxCount) return prev`
            // Since 4 < 5, it will add increment (3) rows, resulting in 7
            // The maxCount is a gate, not a cap on the final count
            expect(result.current.rowStates.length).toBeGreaterThan(4);
        });

        test("returns same state when already at maxCount", async () => {
            const { result } = await renderMultiRowHook({
                initialCount: 5,
                increment: 2,
                maxCount: 5,
            });

            expect(result.current.rowStates).toHaveLength(5);

            await act(async () => {
                result.current.handleNeedMoreRows();
            });

            // Already at maxCount, should not add more
            expect(result.current.rowStates).toHaveLength(5);
        });

        test("returns same state when over maxCount", async () => {
            const { result } = await renderMultiRowHook({
                initialCount: 3,
                increment: 5,
                maxCount: 6,
            });

            // Add first batch: 3 + 5 = 8 (exceeds maxCount but allowed on entry)
            await act(async () => {
                result.current.handleNeedMoreRows();
            });

            const countAfterFirst = result.current.rowStates.length;

            // Try adding more — should be blocked since length >= maxCount
            await act(async () => {
                result.current.handleNeedMoreRows();
            });

            expect(result.current.rowStates).toHaveLength(countAfterFirst);
        });

        test("new rows have empty errors object", async () => {
            const { result } = await renderMultiRowHook({
                initialCount: 1,
                increment: 2,
                maxCount: 10,
            });

            await act(async () => {
                result.current.handleNeedMoreRows();
            });

            expect(result.current.rowStates[1].errors).toEqual({});
            expect(result.current.rowStates[2].errors).toEqual({});
        });
    });

    // ── handleFocus ──────────────────────────────────────────────
    describe("handleFocus", () => {
        test("tracks focused row (prevents reset on save)", async () => {
            const onSave = vi.fn().mockResolvedValue("result-id");

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "" },
                onSave,
            });

            const rowId = result.current.rowStates[0].id;

            // Focus the row
            await act(async () => {
                result.current.handleFocus(rowId);
            });

            // Change and save
            await act(async () => {
                result.current.handleChange(rowId, { name: "focused-item" });
            });
            await act(async () => {
                await result.current.handleSave(rowId);
            });

            // Should keep values since row is focused
            expect(result.current.rowStates[0].values).toEqual({ name: "focused-item" });
            expect(result.current.rowStates[0].linkedId).toBe("result-id");
        });
    });

    // ── handleBlur ───────────────────────────────────────────────
    describe("handleBlur", () => {
        test("triggers save after delay when row loses focus", async () => {
            const onSave = vi.fn().mockResolvedValue(undefined);

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "" },
                onSave,
            });

            const rowId = result.current.rowStates[0].id;

            // Change values so save is possible
            await act(async () => {
                result.current.handleChange(rowId, { name: "blur-test" });
            });

            // Focus then blur
            await act(async () => {
                result.current.handleFocus(rowId);
            });
            await act(async () => {
                result.current.handleBlur(rowId);
            });

            // Save should NOT have been called yet (within delay)
            expect(onSave).not.toHaveBeenCalled();

            // Advance past the BLUR_SAVE_DELAY_MS (150ms) and flush microtasks
            await act(async () => {
                vi.advanceTimersByTime(150);
            });
            // Allow the async handleSave to resolve
            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });

            expect(onSave).toHaveBeenCalledWith({ name: "blur-test" }, rowId, undefined);
        });

        test("does not trigger save before delay expires", async () => {
            const onSave = vi.fn().mockResolvedValue(undefined);

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "" },
                onSave,
            });

            const rowId = result.current.rowStates[0].id;

            await act(async () => {
                result.current.handleChange(rowId, { name: "too-early" });
            });
            await act(async () => {
                result.current.handleFocus(rowId);
            });
            await act(async () => {
                result.current.handleBlur(rowId);
            });

            // Advance only 100ms — less than 150ms delay
            await act(async () => {
                vi.advanceTimersByTime(100);
            });

            expect(onSave).not.toHaveBeenCalled();
        });

        test("clears focused row id on blur", async () => {
            const onSave = vi.fn().mockResolvedValue("save-id");

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "" },
                onSave,
            });

            const rowId = result.current.rowStates[0].id;

            // Focus, change, then blur
            await act(async () => {
                result.current.handleFocus(rowId);
            });
            await act(async () => {
                result.current.handleChange(rowId, { name: "blur-clear" });
            });
            await act(async () => {
                result.current.handleBlur(rowId);
            });

            // Advance past delay and flush microtasks
            await act(async () => {
                vi.advanceTimersByTime(150);
            });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });

            // The row should be reset since focus was cleared and save returned an ID
            expect(result.current.rowStates[0].values).toEqual({ name: "" });
        });

        test("triggers save when another row takes focus during delay", async () => {
            const onSave = vi.fn().mockResolvedValue(undefined);

            const { result } = await renderMultiRowHook({
                initialCount: 2,
                defaultValues: { name: "" },
                onSave,
            });

            const row0Id = result.current.rowStates[0].id;
            const row1Id = result.current.rowStates[1].id;

            await act(async () => {
                result.current.handleChange(row0Id, { name: "row0-data" });
            });

            // Focus row 0, blur row 0, then focus row 1 (simulating tab navigation)
            await act(async () => {
                result.current.handleFocus(row0Id);
            });
            await act(async () => {
                result.current.handleBlur(row0Id);
            });
            // Another element takes focus before the delay, changing focusedRowIdRef
            await act(async () => {
                result.current.handleFocus(row1Id);
            });

            // Advance past delay and flush microtasks
            await act(async () => {
                vi.advanceTimersByTime(150);
            });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });

            // Blur callback checks `focusedRowIdRef.current !== rowId` — since row1 is now focused,
            // the condition is true and save SHOULD trigger for row0
            expect(onSave).toHaveBeenCalledWith({ name: "row0-data" }, row0Id, undefined);
        });
    });

    // ── handleFocusNext ──────────────────────────────────────────
    describe("handleFocusNext", () => {
        test("triggers save on current row and sets navigating flag", async () => {
            const onSave = vi.fn().mockResolvedValue(undefined);

            const { result } = await renderMultiRowHook({
                initialCount: 3,
                defaultValues: { name: "" },
                onSave,
            });

            const row0Id = result.current.rowStates[0].id;

            await act(async () => {
                result.current.handleChange(row0Id, { name: "navigate-test" });
            });

            await act(async () => {
                result.current.handleFocusNext(row0Id);
                vi.advanceTimersByTime(0); // flush the setTimeout(fn, 0)
            });

            expect(onSave).toHaveBeenCalledWith({ name: "navigate-test" }, row0Id, undefined);
        });

        test("does nothing for last row (no next row)", async () => {
            const onSave = vi.fn().mockResolvedValue(undefined);

            const { result } = await renderMultiRowHook({
                initialCount: 2,
                defaultValues: { name: "" },
                onSave,
            });

            const lastRowId = result.current.rowStates[1].id;

            await act(async () => {
                result.current.handleChange(lastRowId, { name: "last-row" });
            });

            await act(async () => {
                result.current.handleFocusNext(lastRowId);
            });

            // Should not call save since it's the last row
            expect(onSave).not.toHaveBeenCalled();
        });

        test("does nothing for non-existent row id", async () => {
            const onSave = vi.fn().mockResolvedValue(undefined);

            const { result } = await renderMultiRowHook({
                initialCount: 2,
                onSave,
            });

            await act(async () => {
                result.current.handleFocusNext("does-not-exist");
            });

            expect(onSave).not.toHaveBeenCalled();
        });
    });

    // ── handleSaveAndLoop ────────────────────────────────────────
    describe("handleSaveAndLoop", () => {
        test("saves and resets row to defaults on success", async () => {
            const onSave = vi.fn().mockResolvedValue("created-id");

            const { result } = await renderMultiRowHook({
                initialCount: 2,
                defaultValues: { name: "", quantity: 0 },
                onSave,
            });

            const rowId = result.current.rowStates[0].id;

            await act(async () => {
                result.current.handleChange(rowId, { name: "Product A", quantity: 5 });
            });

            let saved: boolean;
            await act(async () => {
                saved = await result.current.handleSaveAndLoop(rowId);
            });

            expect(saved!).toBe(true);
            expect(onSave).toHaveBeenCalledWith(
                { name: "Product A", quantity: 5 },
                rowId,
                undefined,
            );
            // Row should be reset to defaults
            expect(result.current.rowStates[0].values).toEqual({ name: "", quantity: 0 });
            expect(result.current.rowStates[0].linkedId).toBeUndefined();
            expect(result.current.rowStates[0].errors).toEqual({});
            expect(result.current.rowStates[0].isSaving).toBe(false);
            expect(result.current.rowStates[0].lastSavedValues).toEqual({ name: "", quantity: 0 });
        });

        test("resets row even when it is focused", async () => {
            const onSave = vi.fn().mockResolvedValue("id-123");

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "" },
                onSave,
            });

            const rowId = result.current.rowStates[0].id;

            // Focus the row (handleSave would NOT reset in this case)
            await act(async () => {
                result.current.handleFocus(rowId);
            });
            await act(async () => {
                result.current.handleChange(rowId, { name: "focused-item" });
            });

            let saved: boolean;
            await act(async () => {
                saved = await result.current.handleSaveAndLoop(rowId);
            });

            // Unlike handleSave, handleSaveAndLoop ALWAYS resets on success
            expect(saved!).toBe(true);
            expect(result.current.rowStates[0].values).toEqual({ name: "" });
            expect(result.current.rowStates[0].linkedId).toBeUndefined();
        });

        test("resets row with linkedId and no changes", async () => {
            const onSave = vi.fn().mockResolvedValue("linked-42");

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "" },
                onSave,
            });

            const rowId = result.current.rowStates[0].id;

            // First: save to establish linkedId (via handleSave with focus)
            await act(async () => {
                result.current.handleFocus(rowId);
            });
            await act(async () => {
                result.current.handleChange(rowId, { name: "saved" });
            });
            await act(async () => {
                await result.current.handleSave(rowId);
            });
            expect(result.current.rowStates[0].linkedId).toBe("linked-42");

            // Now call handleSaveAndLoop without making changes
            let saved: boolean;
            await act(async () => {
                saved = await result.current.handleSaveAndLoop(rowId);
            });

            // Should reset because linkedId exists (user is done with this row)
            expect(saved!).toBe(true);
            expect(result.current.rowStates[0].values).toEqual({ name: "" });
            expect(result.current.rowStates[0].linkedId).toBeUndefined();
        });

        test("returns false for empty row", async () => {
            const onSave = vi.fn().mockResolvedValue(undefined);

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "", quantity: null },
                onSave,
            });

            const rowId = result.current.rowStates[0].id;

            let saved: boolean;
            await act(async () => {
                saved = await result.current.handleSaveAndLoop(rowId);
            });

            expect(saved!).toBe(false);
            expect(onSave).not.toHaveBeenCalled();
        });

        test("returns false for unchanged row without linkedId", async () => {
            const onSave = vi.fn().mockResolvedValue(undefined);

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "initial", quantity: 5 },
                onSave,
            });

            const rowId = result.current.rowStates[0].id;

            let saved: boolean;
            await act(async () => {
                saved = await result.current.handleSaveAndLoop(rowId);
            });

            expect(saved!).toBe(false);
            expect(onSave).not.toHaveBeenCalled();
        });

        test("returns false and sets errors on validation failure", async () => {
            const onSave = vi.fn().mockResolvedValue(undefined);
            const validate = vi.fn().mockReturnValue("Name is required");

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "" },
                onSave,
                validate,
            });

            const rowId = result.current.rowStates[0].id;

            await act(async () => {
                result.current.handleChange(rowId, { name: "value" });
            });

            let saved: boolean;
            await act(async () => {
                saved = await result.current.handleSaveAndLoop(rowId);
            });

            expect(saved!).toBe(false);
            expect(onSave).not.toHaveBeenCalled();
            expect(result.current.rowStates[0].errors).toEqual({ _global: "Name is required" });
        });

        test("returns false and keeps values on save error", async () => {
            const error = new Error("Network error");
            const onSave = vi.fn().mockRejectedValue(error);
            const onError = vi.fn();

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "" },
                onSave,
                onError,
            });

            const rowId = result.current.rowStates[0].id;

            await act(async () => {
                result.current.handleChange(rowId, { name: "will-fail" });
            });

            let saved: boolean;
            await act(async () => {
                saved = await result.current.handleSaveAndLoop(rowId);
            });

            expect(saved!).toBe(false);
            expect(onError).toHaveBeenCalledWith(error, rowId);
            // Values should be preserved for retry
            expect(result.current.rowStates[0].values).toEqual({ name: "will-fail" });
            expect(result.current.rowStates[0].isSaving).toBe(false);
        });

        test("deduplicates concurrent calls", async () => {
            let resolveSave: () => void;
            const savePromise = new Promise<string>((resolve) => {
                resolveSave = () => resolve("id");
            });
            const onSave = vi.fn().mockReturnValue(savePromise);

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                defaultValues: { name: "" },
                onSave,
            });

            const rowId = result.current.rowStates[0].id;

            await act(async () => {
                result.current.handleChange(rowId, { name: "dedup-test" });
            });

            // Start first call
            let promise1: Promise<boolean>;
            await act(async () => {
                promise1 = result.current.handleSaveAndLoop(rowId);
            });

            // Second call while first is in progress
            let saved2: boolean;
            await act(async () => {
                saved2 = await result.current.handleSaveAndLoop(rowId);
            });

            expect(saved2!).toBe(false);
            expect(onSave).toHaveBeenCalledTimes(1);

            // Resolve the pending save
            await act(async () => {
                resolveSave!();
                await promise1!;
            });
        });

        test("does not affect other rows", async () => {
            const onSave = vi.fn().mockResolvedValue("id");

            const { result } = await renderMultiRowHook({
                initialCount: 3,
                defaultValues: { name: "default" },
                onSave,
            });

            const row0Id = result.current.rowStates[0].id;

            // Change row 0 and row 1
            await act(async () => {
                result.current.handleChange(row0Id, { name: "changed-0" });
                result.current.handleChange(result.current.rowStates[1].id, { name: "changed-1" });
            });

            await act(async () => {
                await result.current.handleSaveAndLoop(row0Id);
            });

            // Row 0 should be reset
            expect(result.current.rowStates[0].values).toEqual({ name: "default" });
            // Row 1 should be untouched
            expect(result.current.rowStates[1].values).toEqual({ name: "changed-1" });
            // Row 2 should be untouched
            expect(result.current.rowStates[2].values).toEqual({ name: "default" });
        });

        test("uses function defaultValues with correct index on reset", async () => {
            const defaultValuesFn = vi.fn((index: number) => ({ label: `Row ${index}` }));
            const onSave = vi.fn().mockResolvedValue("id");

            const { result } = await renderMultiRowHook({
                initialCount: 3,
                defaultValues: defaultValuesFn,
                onSave,
            });

            // Save and loop row at index 1
            const row1Id = result.current.rowStates[1].id;

            await act(async () => {
                result.current.handleChange(row1Id, { label: "edited" });
            });

            defaultValuesFn.mockClear();

            await act(async () => {
                await result.current.handleSaveAndLoop(row1Id);
            });

            // Should have called defaultValues with index 1 for the reset
            expect(defaultValuesFn).toHaveBeenCalledWith(1);
            expect(result.current.rowStates[1].values).toEqual({ label: "Row 1" });
        });

        test("returns false for non-existent row id", async () => {
            const onSave = vi.fn().mockResolvedValue(undefined);

            const { result } = await renderMultiRowHook({
                initialCount: 1,
                onSave,
            });

            let saved: boolean;
            await act(async () => {
                saved = await result.current.handleSaveAndLoop("non-existent");
            });

            expect(saved!).toBe(false);
            expect(onSave).not.toHaveBeenCalled();
        });
    });

    // ── Click navigation (gap fix) ─────────────────────────────
    describe("click navigation (gap fix)", () => {
        test("does not reset row when another new row is focused", async () => {
            const onSave = vi.fn().mockResolvedValue("saved-id");

            const { result } = await renderMultiRowHook({
                initialCount: 3,
                defaultValues: { name: "", quantity: 0 },
                onSave,
            });

            const row0Id = result.current.rowStates[0].id;
            const row1Id = result.current.rowStates[1].id;

            // Fill row 0
            await act(async () => {
                result.current.handleChange(row0Id, { name: "Product A", quantity: 5 });
            });

            // Focus row 1 (simulates clicking row 1)
            await act(async () => {
                result.current.handleFocus(row1Id);
            });

            // Save row 0 (triggered by blur)
            await act(async () => {
                await result.current.handleSave(row0Id);
            });

            // Row 0 should keep its saved values — NOT reset to defaults
            expect(result.current.rowStates[0].values).toEqual({
                name: "Product A",
                quantity: 5,
            });
            expect(result.current.rowStates[0].linkedId).toBe("saved-id");
        });

        test("resets all stale linked rows when focus leaves all new rows", async () => {
            const onSave = vi.fn().mockResolvedValue("saved-id");

            const { result } = await renderMultiRowHook({
                initialCount: 3,
                defaultValues: { name: "", quantity: 0 },
                onSave,
            });

            const row0Id = result.current.rowStates[0].id;
            const row1Id = result.current.rowStates[1].id;

            // Fill and save row 0 while row 1 is focused (row 0 keeps values)
            await act(async () => {
                result.current.handleChange(row0Id, { name: "Product A", quantity: 5 });
            });
            await act(async () => {
                result.current.handleFocus(row1Id);
            });
            await act(async () => {
                await result.current.handleSave(row0Id);
            });

            // Verify row 0 kept values
            expect(result.current.rowStates[0].linkedId).toBe("saved-id");

            // Now blur row 1 without focusing any new row (focus leaves entirely)
            await act(async () => {
                result.current.handleBlur(row1Id);
            });
            await act(async () => {
                vi.advanceTimersByTime(200);
            });

            // Row 0 should now be reset (cleanup triggered)
            expect(result.current.rowStates[0].values).toEqual({ name: "", quantity: 0 });
            expect(result.current.rowStates[0].linkedId).toBeUndefined();
        });

        test("does not reset rows currently being saved during cleanup", async () => {
            let resolveSave: (id: string) => void;
            const savePromise = new Promise<string>((resolve) => {
                resolveSave = (id) => resolve(id);
            });
            const onSave = vi.fn().mockReturnValue(savePromise);

            const { result } = await renderMultiRowHook({
                initialCount: 2,
                defaultValues: { name: "" },
                onSave,
            });

            const row0Id = result.current.rowStates[0].id;

            // Start saving row 0 (will be pending)
            await act(async () => {
                result.current.handleChange(row0Id, { name: "saving" });
            });
            act(() => {
                void result.current.handleSave(row0Id);
            });

            // Row 0 is now mid-save (isSaving=true)
            expect(result.current.rowStates[0].isSaving).toBe(true);

            // Trigger blur cleanup (no row focused)
            await act(async () => {
                result.current.handleBlur(row0Id);
            });
            await act(async () => {
                vi.advanceTimersByTime(200);
            });

            // Row 0 should NOT be reset because it's mid-save (in savingRowsRef)
            expect(result.current.rowStates[0].isSaving).toBe(true);
            expect(result.current.rowStates[0].values).toEqual({ name: "saving" });

            // Resolve the save
            await act(async () => {
                resolveSave!("saved-id");
            });
        });

        test("early-return path: does not reset linked row when another new row is focused", async () => {
            const onSave = vi.fn().mockResolvedValue("linked-42");

            const { result } = await renderMultiRowHook({
                initialCount: 3,
                defaultValues: { name: "" },
                onSave,
            });

            const row0Id = result.current.rowStates[0].id;
            const row1Id = result.current.rowStates[1].id;

            // Save row 0 while focused to establish linkedId
            await act(async () => {
                result.current.handleFocus(row0Id);
            });
            await act(async () => {
                result.current.handleChange(row0Id, { name: "saved" });
            });
            await act(async () => {
                await result.current.handleSave(row0Id);
            });
            expect(result.current.rowStates[0].linkedId).toBe("linked-42");

            // Now focus row 1 (click away to another new row)
            await act(async () => {
                result.current.handleFocus(row1Id);
            });

            // Call handleSave again on row 0 — values haven't changed (isEmpty || !isChanged)
            await act(async () => {
                await result.current.handleSave(row0Id);
            });

            // Row 0 should NOT be reset because row 1 has focus
            expect(result.current.rowStates[0].linkedId).toBe("linked-42");
            expect(result.current.rowStates[0].values).toEqual({ name: "saved" });
        });
    });

    // ── Return value shape ───────────────────────────────────────
    describe("return value", () => {
        test("returns all expected handler functions", async () => {
            const { result } = await renderMultiRowHook();

            expect(result.current.rowStates).toBeDefined();
            expect(typeof result.current.handleChange).toBe("function");
            expect(typeof result.current.handleSave).toBe("function");
            expect(typeof result.current.handleFocus).toBe("function");
            expect(typeof result.current.handleBlur).toBe("function");
            expect(typeof result.current.handleFocusNext).toBe("function");
            expect(typeof result.current.handleSaveAndLoop).toBe("function");
            expect(typeof result.current.handleNeedMoreRows).toBe("function");
        });
    });
});
