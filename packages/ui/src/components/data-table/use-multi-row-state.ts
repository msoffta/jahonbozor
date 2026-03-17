import * as React from "react";

import type { NewRowState } from "./types";

/** Delay before triggering blur save — allows dropdowns/navigation to complete */
const BLUR_SAVE_DELAY_MS = 150;

interface UseMultiRowStateOptions {
    enabled: boolean;
    initialCount: number;
    increment: number;
    maxCount: number;
    defaultValues?: Record<string, unknown> | ((index: number) => Record<string, unknown>);
    validate?: (values: Record<string, unknown>) => boolean | string;
    onSave?: (
        values: Record<string, unknown>,
        rowId: string,
        linkedId?: unknown,
        // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- intentional: documents sync or async return
    ) => unknown | Promise<unknown>;
    onChange?: (values: Record<string, unknown>, rowId: string) => Record<string, unknown> | void;
    onError?: (error: unknown, rowId: string) => void;
}

export function useMultiRowState({
    enabled,
    initialCount,
    increment,
    maxCount,
    defaultValues,
    validate,
    onSave,
    onChange,
    onError,
}: UseMultiRowStateOptions) {
    const [rowStates, setRowStates] = React.useState<NewRowState[]>([]);
    const [, setFocusedRowId] = React.useState<string | null>(null);
    const focusedRowIdRef = React.useRef<string | null>(null);
    const savingRowsRef = React.useRef<Set<string>>(new Set());
    const navigatingFromRowRef = React.useRef<string | null>(null);

    // Initialize rows if enabled
    React.useEffect(() => {
        if (!enabled) return;

        setRowStates((prev) => {
            if (prev.length > 0) return prev;

            return Array.from({ length: initialCount }, (_, index) => {
                const defaults =
                    typeof defaultValues === "function"
                        ? defaultValues(index)
                        : { ...defaultValues };
                return {
                    id: `__new_row_${Date.now()}_${index}`,
                    values: defaults,
                    errors: {},
                    lastSavedValues: defaults,
                };
            });
        });
    }, [enabled, initialCount]); // Removed defaultValues from deps to avoid reset

    const handleChange = React.useCallback(
        (rowId: string, values: Record<string, unknown>) => {
            let updatedValues = values;
            const result = onChange?.(values, rowId);
            if (result && typeof result === "object") {
                updatedValues = result;
            }

            setRowStates((prev) =>
                prev.map((row) => (row.id === rowId ? { ...row, values: updatedValues } : row)),
            );
        },
        [onChange],
    );

    const handleSave = React.useCallback(
        async (rowId: string) => {
            if (savingRowsRef.current.has(rowId)) return;

            const rowState = rowStates.find((s) => s.id === rowId);
            if (!rowState || rowState.isSaving) return;

            const isChanged = Object.keys(rowState.values).some(
                (key) => rowState.values[key] !== rowState.lastSavedValues?.[key],
            );

            const isEmpty = Object.values(rowState.values).every(
                (v) => v === "" || v === null || v === undefined,
            );

            if (isEmpty || !isChanged) {
                const isStillFocused = focusedRowIdRef.current === rowId;
                if (!isStillFocused && rowState.linkedId) {
                    setRowStates((prev) =>
                        prev.map((row) => {
                            if (row.id !== rowId) return row;
                            const index = prev.findIndex((s) => s.id === rowId);
                            const defaults =
                                typeof defaultValues === "function"
                                    ? defaultValues(index)
                                    : { ...defaultValues };
                            return {
                                ...row,
                                values: defaults,
                                errors: {},
                                linkedId: undefined,
                                isSaving: false,
                                lastSavedValues: defaults,
                            };
                        }),
                    );
                }
                return;
            }

            if (validate) {
                const result = validate(rowState.values);
                if (typeof result === "string") {
                    setRowStates((prev) =>
                        prev.map((row) =>
                            row.id === rowId ? { ...row, errors: { _global: result } } : row,
                        ),
                    );
                    return;
                }
                if (result === false) return;
            }

            savingRowsRef.current.add(rowId);
            setRowStates((prev) =>
                prev.map((row) => (row.id === rowId ? { ...row, isSaving: true } : row)),
            );

            const valuesToSave = { ...rowState.values };

            try {
                const resultId = await onSave?.(valuesToSave, rowId, rowState.linkedId);

                setRowStates((prev) =>
                    prev.map((row) => {
                        if (row.id !== rowId) return row;

                        const isStillFocused = focusedRowIdRef.current === rowId;
                        const isNavigating = navigatingFromRowRef.current === rowId;

                        if (resultId && !isStillFocused && !isNavigating) {
                            const index = prev.findIndex((s) => s.id === rowId);
                            const defaults =
                                typeof defaultValues === "function"
                                    ? defaultValues(index)
                                    : { ...defaultValues };

                            return {
                                ...row,
                                values: defaults,
                                errors: {},
                                linkedId: undefined,
                                isSaving: false,
                                lastSavedValues: defaults,
                            };
                        }

                        return {
                            ...row,
                            linkedId: resultId ?? row.linkedId,
                            isSaving: false,
                            lastSavedValues: valuesToSave,
                        };
                    }),
                );
            } catch (error) {
                onError?.(error, rowId);
                setRowStates((prev) =>
                    prev.map((row) => (row.id === rowId ? { ...row, isSaving: false } : row)),
                );
            } finally {
                savingRowsRef.current.delete(rowId);
            }
        },
        [rowStates, validate, onSave, defaultValues, onError],
    );

    const handleFocus = React.useCallback((rowId: string) => {
        setFocusedRowId(rowId);
        focusedRowIdRef.current = rowId;
    }, []);

    const handleBlur = React.useCallback(
        (rowId: string) => {
            setTimeout(() => {
                if (focusedRowIdRef.current === rowId) {
                    setFocusedRowId(null);
                    focusedRowIdRef.current = null;
                }

                const isNavigating = navigatingFromRowRef.current === rowId;
                if (focusedRowIdRef.current !== rowId && !isNavigating) {
                    void handleSave(rowId);
                }

                if (navigatingFromRowRef.current === rowId) {
                    navigatingFromRowRef.current = null;
                }
            }, BLUR_SAVE_DELAY_MS);
        },
        [handleSave],
    );

    const handleFocusNext = React.useCallback(
        (rowId: string) => {
            const index = rowStates.findIndex((r) => r.id === rowId);
            if (index !== -1 && index < rowStates.length - 1) {
                const nextRow = rowStates[index + 1];

                navigatingFromRowRef.current = rowId;
                void handleSave(rowId);

                setTimeout(() => {
                    const nextRowEl = document.getElementById(nextRow.id);
                    const firstInput =
                        nextRowEl?.querySelector<HTMLElement>("input, button, select");
                    firstInput?.focus();
                }, 0);
            }
        },
        [rowStates, handleSave],
    );

    const handleNeedMoreRows = React.useCallback(() => {
        setRowStates((prev) => {
            if (prev.length >= maxCount) return prev;

            const currentCount = prev.length;
            const moreRows: NewRowState[] = Array.from({ length: increment }, (_, index) => ({
                id: `__new_row_${Date.now()}_${currentCount + index}`,
                values:
                    typeof defaultValues === "function"
                        ? defaultValues(currentCount + index)
                        : { ...defaultValues },
                errors: {},
            }));
            return [...prev, ...moreRows];
        });
    }, [maxCount, increment, defaultValues]);

    return {
        rowStates,
        handleChange,
        handleSave,
        handleFocus,
        handleBlur,
        handleFocusNext,
        handleNeedMoreRows,
    };
}
