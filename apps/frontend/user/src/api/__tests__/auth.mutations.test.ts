import { describe, test, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAuthStore } from "@/stores/auth.store";
import { useUIStore } from "@/stores/ui.store";

type EdenFn = (...args: unknown[]) => Promise<{ data: unknown; error: unknown }>;

const { mockTelegramPost, mockLogoutPost, mockLanguagePut } = vi.hoisted(() => ({
    mockTelegramPost: vi.fn<EdenFn>(() =>
        Promise.resolve({
            data: {
                success: true,
                data: {
                    token: "test-token",
                    user: {
                        id: 1,
                        fullname: "Test User",
                        telegramId: "123456",
                        phone: "+998901234567",
                        language: "uz",
                    },
                },
            },
            error: null,
        }),
    ),
    mockLogoutPost: vi.fn<EdenFn>(() =>
        Promise.resolve({ data: null, error: null }),
    ),
    mockLanguagePut: vi.fn<EdenFn>(() =>
        Promise.resolve({ data: { success: true }, error: null }),
    ),
}));

vi.mock("@/lib/api-client", () => ({
    api: {
        api: {
            public: {
                auth: {
                    me: {
                        get: vi.fn(() =>
                            Promise.resolve({
                                data: { success: true, data: {} },
                                error: null,
                            }),
                        ),
                    },
                    logout: { post: mockLogoutPost },
                },
                users: {
                    telegram: { post: mockTelegramPost },
                    language: { put: mockLanguagePut },
                },
            },
        },
    },
}));

vi.mock("@tanstack/react-query", () => ({
    QueryClient: class MockQueryClient {
        defaultOptions = {};
        clear = vi.fn();
        constructor() {}
    },
    useMutation: ({ mutationFn, onSuccess, onSettled }: any) => ({
        mutate: async (...args: any[]) => {
            try {
                const result = await mutationFn(...args);
                if (onSuccess) await onSuccess(result, ...args);
                return result;
            } catch (e) {
                throw e;
            } finally {
                if (onSettled) onSettled();
            }
        },
        mutateAsync: mutationFn,
        isPending: false,
        isError: false,
    }),
    queryOptions: (opts: any) => opts,
}));

vi.mock("@sentry/react", () => ({
    setUser: vi.fn(),
}));

import * as Sentry from "@sentry/react";
import { useTelegramLogin, useLogout, useUpdateLanguage } from "../auth.api";

describe("useTelegramLogin", () => {
    const loginBody = {
        id: "123",
        first_name: "Test",
        last_name: "User",
        username: "testuser",
        photo_url: "https://example.com/photo.jpg",
        auth_date: 1234567890,
        hash: "abc123",
    };

    beforeEach(() => {
        useAuthStore.setState({
            token: null,
            user: null,
            isAuthenticated: false,
        });
        useUIStore.setState({ locale: "uz" });
    });

    test("should call API with body and current locale", async () => {
        useUIStore.setState({ locale: "ru" });
        const { result } = renderHook(() => useTelegramLogin());
        await result.current.mutate(loginBody);

        expect(mockTelegramPost).toHaveBeenCalledWith({
            ...loginBody,
            id: "123",
            language: "ru",
        });
    });

    test("should set auth store on successful login", async () => {
        const { result } = renderHook(() => useTelegramLogin());
        await result.current.mutate(loginBody);

        const state = useAuthStore.getState();
        expect(state.token).toBe("test-token");
        expect(state.isAuthenticated).toBe(true);
        expect(state.user).toEqual({
            id: 1,
            name: "Test User",
            telegramId: "123456",
            phone: "+998901234567",
            language: "uz",
            type: "user",
        });
    });

    test("should set UI locale from user language", async () => {
        mockTelegramPost.mockResolvedValueOnce({
            data: {
                success: true,
                data: {
                    token: "t",
                    user: {
                        id: 1,
                        fullname: "U",
                        telegramId: "1",
                        phone: null,
                        language: "ru",
                    },
                },
            },
            error: null,
        });

        const { result } = renderHook(() => useTelegramLogin());
        await result.current.mutate(loginBody);

        expect(useUIStore.getState().locale).toBe("ru");
    });

    test("should default to uz for unknown language", async () => {
        mockTelegramPost.mockResolvedValueOnce({
            data: {
                success: true,
                data: {
                    token: "t",
                    user: {
                        id: 1,
                        fullname: "U",
                        telegramId: "1",
                        phone: null,
                        language: "en",
                    },
                },
            },
            error: null,
        });

        const { result } = renderHook(() => useTelegramLogin());
        await result.current.mutate(loginBody);

        expect(useUIStore.getState().locale).toBe("uz");
    });

    test("should throw on API error", async () => {
        mockTelegramPost.mockResolvedValueOnce({
            data: null,
            error: new Error("Network error"),
        });

        const { result } = renderHook(() => useTelegramLogin());
        await expect(result.current.mutate(loginBody)).rejects.toThrow(
            "Network error",
        );
    });

    test("should not set auth when result has no data", async () => {
        mockTelegramPost.mockResolvedValueOnce({
            data: { success: false },
            error: null,
        });

        const { result } = renderHook(() => useTelegramLogin());
        await result.current.mutate(loginBody);

        expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    test("should convert numeric id to string", async () => {
        const bodyWithNumId = { ...loginBody, id: 456 as any };
        const { result } = renderHook(() => useTelegramLogin());
        await result.current.mutate(bodyWithNumId);

        expect(mockTelegramPost).toHaveBeenCalledWith(
            expect.objectContaining({ id: "456" }),
        );
    });

    test("should handle null phone in response", async () => {
        mockTelegramPost.mockResolvedValueOnce({
            data: {
                success: true,
                data: {
                    token: "t",
                    user: {
                        id: 2,
                        fullname: "No Phone",
                        telegramId: "789",
                        phone: null,
                        language: "uz",
                    },
                },
            },
            error: null,
        });

        const { result } = renderHook(() => useTelegramLogin());
        await result.current.mutate(loginBody);

        expect(useAuthStore.getState().user?.phone).toBeNull();
    });

    test("should call Sentry.setUser on successful login", async () => {
        const { result } = renderHook(() => useTelegramLogin());
        await result.current.mutate(loginBody);

        expect(Sentry.setUser).toHaveBeenCalledWith({
            id: "1",
            username: "Test User",
        });
    });
});

describe("useLogout", () => {
    beforeEach(() => {
        useAuthStore.setState({
            token: "existing-token",
            user: {
                id: 1,
                name: "Test",
                telegramId: "1",
                phone: null,
                language: "uz",
                type: "user" as const,
            },
            isAuthenticated: true,
        });
    });

    test("should call logout API", async () => {
        const { result } = renderHook(() => useLogout());
        await result.current.mutate();

        expect(mockLogoutPost).toHaveBeenCalled();
    });

    test("should clear auth store on settled", async () => {
        const { result } = renderHook(() => useLogout());
        await result.current.mutate();

        const state = useAuthStore.getState();
        expect(state.token).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.user).toBeNull();
    });

    test("should clear Sentry user on logout", async () => {
        const { result } = renderHook(() => useLogout());
        await result.current.mutate();

        expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });

    test("should clear auth store even on API error", async () => {
        mockLogoutPost.mockResolvedValueOnce({
            data: null,
            error: new Error("Network error"),
        });

        const { result } = renderHook(() => useLogout());
        try {
            await result.current.mutate();
        } catch {
            // expected — mutationFn throws on error
        }

        // onSettled runs via finally, so logout should still happen
        expect(useAuthStore.getState().isAuthenticated).toBe(false);
        expect(useAuthStore.getState().token).toBeNull();
    });
});

describe("useUpdateLanguage", () => {
    test("should call API with ru language", async () => {
        const { result } = renderHook(() => useUpdateLanguage());
        await result.current.mutate("ru");

        expect(mockLanguagePut).toHaveBeenCalledWith({ language: "ru" });
    });

    test("should call API with uz language", async () => {
        const { result } = renderHook(() => useUpdateLanguage());
        await result.current.mutate("uz");

        expect(mockLanguagePut).toHaveBeenCalledWith({ language: "uz" });
    });

    test("should throw on API error", async () => {
        mockLanguagePut.mockResolvedValueOnce({
            data: null,
            error: new Error("Unauthorized"),
        });

        const { result } = renderHook(() => useUpdateLanguage());
        await expect(result.current.mutate("ru")).rejects.toThrow(
            "Unauthorized",
        );
    });

    test("should return data on success", async () => {
        mockLanguagePut.mockResolvedValueOnce({
            data: { success: true, message: "Language updated" },
            error: null,
        });

        const { result } = renderHook(() => useUpdateLanguage());
        const data = await result.current.mutateAsync("uz");

        expect(data).toEqual({ success: true, message: "Language updated" });
    });
});
