import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { useDeferredReady } from "../use-deferred-ready";

describe("useDeferredReady", () => {
    test("should return false initially", () => {
        const { result } = renderHook(() => useDeferredReady(1000));

        expect(result.current).toBe(false);
    });

    test("should return true after delay", async () => {
        const { result } = renderHook(() => useDeferredReady(10));

        // Wait for the timeout to fire
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
        });

        expect(result.current).toBe(true);
    });

    test("should use default delay of 150ms", () => {
        const { result } = renderHook(() => useDeferredReady());

        // Should still be false immediately
        expect(result.current).toBe(false);
    });

    test("should accept custom delay", async () => {
        const { result } = renderHook(() => useDeferredReady(10));

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
        });

        expect(result.current).toBe(true);
    });
});
