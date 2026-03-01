import { describe, test, expect, beforeEach, mock } from "bun:test";

// Mock api client before importing auth.api
const mockGet = mock(() =>
    Promise.resolve({
        data: { success: true, data: { id: 1, fullname: "Test" } },
        error: null,
    }),
);

mock.module("@/api/client", () => ({
    api: {
        api: {
            public: {
                auth: {
                    me: { get: mockGet },
                },
            },
        },
    },
}));

import { authKeys, meQueryOptions } from "../auth.api";

describe("auth.api", () => {
    beforeEach(() => {
        mock.restore();
    });

    describe("authKeys", () => {
        test("should have correct all key", () => {
            expect(authKeys.all).toEqual(["auth"]);
        });

        test("should have correct me key", () => {
            expect(authKeys.me()).toEqual(["auth", "me"]);
        });

        test("me key should extend all key", () => {
            const meKey = authKeys.me();
            expect(meKey[0]).toBe(authKeys.all[0]);
        });
    });

    describe("meQueryOptions", () => {
        test("should have correct queryKey", () => {
            const options = meQueryOptions();
            expect([...options.queryKey]).toEqual(["auth", "me"]);
        });

        test("should be disabled by default", () => {
            const options = meQueryOptions();
            expect(options.enabled).toBe(false);
        });

        test("should have a queryFn defined", () => {
            const options = meQueryOptions();
            expect(typeof options.queryFn).toBe("function");
        });

        test("queryFn should call api.api.public.auth.me.get", async () => {
            const options = meQueryOptions();
            await options.queryFn!({} as any);
            expect(mockGet).toHaveBeenCalled();
        });

        test("queryFn should return data.data on success", async () => {
            mockGet.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: { id: 42, fullname: "Admin User" },
                },
                error: null,
            });

            const options = meQueryOptions();
            const result = await options.queryFn!({} as any);
            expect(result).toEqual({ id: 42, fullname: "Admin User" });
        });

        test("queryFn should throw on error", async () => {
            mockGet.mockResolvedValueOnce({
                data: null,
                error: { status: 401, message: "Unauthorized" },
            });

            const options = meQueryOptions();
            await expect(options.queryFn!({} as any)).rejects.toBeDefined();
        });

        test("queryFn should throw when data.success is false", async () => {
            mockGet.mockResolvedValueOnce({
                data: { success: false, error: "Something went wrong" },
                error: null,
            });

            const options = meQueryOptions();
            await expect(options.queryFn!({} as any)).rejects.toThrow(
                "Request failed",
            );
        });
    });
});
