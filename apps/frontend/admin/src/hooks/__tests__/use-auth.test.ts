import { describe, test, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuthStore } from "@/stores/auth.store";

interface MockEdenResponse {
    data: Record<string, unknown> | null;
    error: Record<string, unknown> | null;
}

const { mockLoginPost, mockLogoutPost, mockNavigate, mockQueryClientClear, mockSentrySetUser } = vi.hoisted(() => ({
    mockLoginPost: vi.fn(
        (): Promise<MockEdenResponse> => Promise.resolve({ data: null, error: null }),
    ),
    mockLogoutPost: vi.fn(
        (): Promise<MockEdenResponse> => Promise.resolve({ data: null, error: null }),
    ),
    mockNavigate: vi.fn(() => {}),
    mockQueryClientClear: vi.fn(() => {}),
    mockSentrySetUser: vi.fn(() => {}),
}));

vi.mock("@/api/client", () => ({
    api: {
        api: {
            public: {
                auth: {
                    login: { post: mockLoginPost },
                    logout: { post: mockLogoutPost },
                },
            },
        },
    },
}));

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => mockNavigate,
}));

vi.mock("@tanstack/react-query", () => ({
    useMutation: ({ mutationFn, onSuccess, onSettled }: any) => ({
        mutate: async (body: any) => {
            try {
                const result = await mutationFn(body);
                if (onSuccess) await onSuccess(result);
            } catch {
                // error handling
            }
            if (onSettled) onSettled();
        },
        mutateAsync: mutationFn,
        isPending: false,
        isError: false,
    }),
    useQueryClient: () => ({
        clear: mockQueryClientClear,
    }),
}));

vi.mock("@sentry/react", () => ({
    setUser: mockSentrySetUser,
}));

import { useLogin, useLogout } from "../use-auth";

describe("use-auth hooks", () => {
    beforeEach(() => {
        useAuthStore.setState({
            token: null,
            user: null,
            permissions: [],
            isAuthenticated: false,
        });
        vi.clearAllMocks();
    });

    describe("useLogin", () => {
        function mockFetchMe(profileData: Record<string, unknown>) {
            vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
                new Response(JSON.stringify(profileData), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }),
            );
        }

        test("should set auth on successful login", async () => {
            mockLoginPost.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        staff: {
                            id: 1,
                            fullname: "Admin User",
                            username: "admin",
                            roleId: 1,
                        },
                        token: "jwt-token-123",
                    },
                },
                error: null,
            });

            mockFetchMe({
                success: true,
                data: {
                    id: 1,
                    fullname: "Admin User",
                    role: { permissions: ["products:list", "products:create"] },
                },
            });

            const { result } = renderHook(() => useLogin());
            await act(async () => {
                await result.current.mutate({ username: "admin", password: "password" });
            });

            const state = useAuthStore.getState();
            expect(state.token).toBe("jwt-token-123");
            expect(state.user?.fullname).toBe("Admin User");
            expect(state.isAuthenticated).toBe(true);
            expect(state.permissions).toEqual(["products:list", "products:create"]);
        });

        test("should pass token in Authorization header to /me", async () => {
            mockLoginPost.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        staff: {
                            id: 1,
                            fullname: "Admin",
                            username: "admin",
                            roleId: 1,
                        },
                        token: "my-token",
                    },
                },
                error: null,
            });

            const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
                new Response(
                    JSON.stringify({ success: true, data: { role: null } }),
                    { status: 200, headers: { "Content-Type": "application/json" } },
                ),
            );

            const { result } = renderHook(() => useLogin());
            await act(async () => {
                await result.current.mutate({ username: "admin", password: "pass" });
            });

            expect(fetchSpy).toHaveBeenCalledWith("/api/public/auth/me", {
                headers: { Authorization: "Bearer my-token" },
            });
        });

        test("should navigate to / on successful login", async () => {
            mockLoginPost.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        staff: {
                            id: 1,
                            fullname: "Admin",
                            username: "admin",
                            roleId: 1,
                        },
                        token: "token",
                    },
                },
                error: null,
            });

            mockFetchMe({ success: true, data: { role: null } });

            const { result } = renderHook(() => useLogin());
            await act(async () => {
                await result.current.mutate({ username: "admin", password: "pass" });
            });

            expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
        });

        test("should set Sentry user on successful login", async () => {
            mockLoginPost.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        staff: {
                            id: 5,
                            fullname: "Sentry User",
                            username: "sentry",
                            roleId: 1,
                        },
                        token: "token",
                    },
                },
                error: null,
            });

            mockFetchMe({ success: true, data: { role: null } });

            const { result } = renderHook(() => useLogin());
            await act(async () => {
                await result.current.mutate({ username: "sentry", password: "pass" });
            });

            expect(mockSentrySetUser).toHaveBeenCalledWith({
                id: "5",
                username: "Sentry User",
            });
        });

        test("should throw on login error", async () => {
            mockLoginPost.mockResolvedValueOnce({
                data: null,
                error: { status: 401, message: "Invalid credentials" },
            });

            const { result } = renderHook(() => useLogin());
            await expect(
                result.current.mutateAsync({ username: "wrong", password: "wrong" }),
            ).rejects.toThrow("Login failed");
        });

        test("should set empty permissions when me has no role", async () => {
            mockLoginPost.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        staff: {
                            id: 1,
                            fullname: "No Role",
                            username: "norole",
                            roleId: 1,
                        },
                        token: "token",
                    },
                },
                error: null,
            });

            mockFetchMe({ success: true, data: { role: null } });

            const { result } = renderHook(() => useLogin());
            await act(async () => {
                await result.current.mutate({ username: "norole", password: "pass" });
            });

            expect(useAuthStore.getState().permissions).toEqual([]);
        });

        test("should set empty permissions when /me fetch fails", async () => {
            mockLoginPost.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        staff: {
                            id: 1,
                            fullname: "User",
                            username: "user",
                            roleId: 1,
                        },
                        token: "token",
                    },
                },
                error: null,
            });

            vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
                new Response("Unauthorized", { status: 401 }),
            );

            const { result } = renderHook(() => useLogin());
            await act(async () => {
                await result.current.mutate({ username: "user", password: "pass" });
            });

            expect(useAuthStore.getState().permissions).toEqual([]);
        });
    });

    describe("useLogout", () => {
        test("should clear auth store on logout", async () => {
            useAuthStore.getState().setAuth(
                "token",
                { id: 1, fullname: "User", username: "user", roleId: 1, type: "staff" },
                [],
            );

            const { result } = renderHook(() => useLogout());
            await act(async () => {
                await result.current.mutate();
            });

            expect(useAuthStore.getState().isAuthenticated).toBe(false);
            expect(useAuthStore.getState().token).toBeNull();
            expect(useAuthStore.getState().user).toBeNull();
        });

        test("should clear query client on logout", async () => {
            const { result } = renderHook(() => useLogout());
            await act(async () => {
                await result.current.mutate();
            });

            expect(mockQueryClientClear).toHaveBeenCalled();
        });

        test("should navigate to /login on logout", async () => {
            const { result } = renderHook(() => useLogout());
            await act(async () => {
                await result.current.mutate();
            });

            expect(mockNavigate).toHaveBeenCalledWith({ to: "/login" });
        });

        test("should clear Sentry user on logout", async () => {
            const { result } = renderHook(() => useLogout());
            await act(async () => {
                await result.current.mutate();
            });

            expect(mockSentrySetUser).toHaveBeenCalledWith(null);
        });

        test("should call logout API endpoint", async () => {
            const { result } = renderHook(() => useLogout());
            await act(async () => {
                await result.current.mutate();
            });

            expect(mockLogoutPost).toHaveBeenCalled();
        });

        test("should still clear auth even if logout API fails", async () => {
            useAuthStore.getState().setAuth(
                "token",
                { id: 1, fullname: "User", username: "user", roleId: 1, type: "staff" },
                [],
            );

            mockLogoutPost.mockRejectedValueOnce(new Error("Network error"));

            const { result } = renderHook(() => useLogout());
            await act(async () => {
                await result.current.mutate();
            });

            // onSettled runs regardless of error
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
        });
    });
});
