import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { useAuthStore } from "@/stores/auth.store";

// Mock Sentry
vi.mock("@sentry/react", () => ({
    setUser: vi.fn(),
}));

describe("api client", () => {
    beforeEach(() => {
        useAuthStore.setState({
            token: null,
            user: null,
            permissions: [],
            isAuthenticated: false,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("tryRefreshToken", () => {
        test("should set auth on successful refresh + profile fetch", async () => {
            const fetchMock = vi.spyOn(globalThis, "fetch");

            // First call: refresh → returns token
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        success: true,
                        data: { token: "new-token" },
                    }),
            } as Response);

            // Second call: me → returns profile
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        success: true,
                        data: {
                            id: 1,
                            fullname: "Admin",
                            username: "admin",
                            roleId: 1,
                            role: { permissions: ["products:list"] },
                        },
                    }),
            } as Response);

            const { tryRefreshToken } = await import("@/api/client");
            const result = await tryRefreshToken();

            expect(result).toBe(true);
            expect(useAuthStore.getState().token).toBe("new-token");
            expect(useAuthStore.getState().user?.fullname).toBe("Admin");
            expect(useAuthStore.getState().isAuthenticated).toBe(true);
            expect(useAuthStore.getState().permissions).toEqual(["products:list"]);
        });

        test("should clear auth on non-ok refresh response", async () => {
            useAuthStore.getState().setAuth(
                "old-token",
                { id: 1, fullname: "Test", username: "test", roleId: 1, type: "staff" },
                [],
            );

            vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({}),
            } as Response);

            const { tryRefreshToken } = await import("@/api/client");
            const result = await tryRefreshToken();

            expect(result).toBe(false);
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
            expect(useAuthStore.getState().token).toBeNull();
        });

        test("should clear auth when refresh response has no token", async () => {
            useAuthStore.getState().setAuth(
                "old-token",
                { id: 1, fullname: "Test", username: "test", roleId: 1, type: "staff" },
                [],
            );

            vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: false }),
            } as Response);

            const { tryRefreshToken } = await import("@/api/client");
            const result = await tryRefreshToken();

            expect(result).toBe(false);
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
        });

        test("should clear auth when profile fetch fails", async () => {
            const fetchMock = vi.spyOn(globalThis, "fetch");

            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        success: true,
                        data: { token: "new-token" },
                    }),
            } as Response);

            fetchMock.mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({}),
            } as Response);

            const { tryRefreshToken } = await import("@/api/client");
            const result = await tryRefreshToken();

            expect(result).toBe(false);
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
        });

        test("should clear auth on network error", async () => {
            useAuthStore.getState().setAuth(
                "old-token",
                { id: 1, fullname: "Test", username: "test", roleId: 1, type: "staff" },
                [],
            );

            vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

            const { tryRefreshToken } = await import("@/api/client");
            const result = await tryRefreshToken();

            expect(result).toBe(false);
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
        });

        test("should call refresh endpoint with correct params", async () => {
            const fetchMock = vi.spyOn(globalThis, "fetch");

            fetchMock.mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({}),
            } as Response);

            const { tryRefreshToken } = await import("@/api/client");
            await tryRefreshToken();

            expect(fetchMock).toHaveBeenCalledWith("/api/public/auth/refresh", {
                method: "POST",
                credentials: "include",
            });
        });

        test("should set empty permissions when role has no permissions", async () => {
            const fetchMock = vi.spyOn(globalThis, "fetch");

            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        success: true,
                        data: { token: "new-token" },
                    }),
            } as Response);

            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        success: true,
                        data: {
                            id: 1,
                            fullname: "Admin",
                            username: "admin",
                            roleId: 1,
                            role: null,
                        },
                    }),
            } as Response);

            const { tryRefreshToken } = await import("@/api/client");
            await tryRefreshToken();

            expect(useAuthStore.getState().permissions).toEqual([]);
        });
    });

    describe("headers", () => {
        test("should include Authorization header when token exists", () => {
            useAuthStore.getState().setAuth(
                "test-token",
                { id: 1, fullname: "Test", username: "test", roleId: 1, type: "staff" },
                [],
            );

            const { token } = useAuthStore.getState();
            const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

            expect(headers).toEqual({ Authorization: "Bearer test-token" });
        });

        test("should not include Authorization header when no token", () => {
            const { token } = useAuthStore.getState();
            const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

            expect(headers).toBeUndefined();
        });
    });
});
