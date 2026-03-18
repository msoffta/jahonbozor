import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useAuthStore } from "@/stores/auth.store";
import { useUIStore } from "@/stores/ui.store";

type EdenFn = (...args: unknown[]) => Promise<{ data: unknown; error: unknown }>;

const {
    mockTelegramPost,
    mockLogoutPost,
    mockLanguagePut,
    mockNavigate,
    mockClear,
    mockToastError,
} = vi.hoisted(() => ({
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
    mockLogoutPost: vi.fn<EdenFn>(() => Promise.resolve({ data: null, error: null })),
    mockLanguagePut: vi.fn<EdenFn>(() => Promise.resolve({ data: { success: true }, error: null })),
    mockNavigate: vi.fn(),
    mockClear: vi.fn(),
    mockToastError: vi.fn(),
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

vi.mock("@jahonbozor/ui", () => ({
    toast: { error: mockToastError },
}));

vi.mock("@/lib/i18n", () => ({
    i18n: { t: (key: string) => key },
}));

vi.mock("@tanstack/react-query", () => ({
    useMutation: ({ mutationFn, onSuccess, onError, onSettled }: any) => ({
        mutate: async (...args: any[]) => {
            try {
                const result = await mutationFn(...args);
                if (onSuccess) await onSuccess(result, ...args);
                return result;
            } catch (e) {
                if (onError) onError(e);
                throw e;
            } finally {
                if (onSettled) onSettled();
            }
        },
        mutateAsync: mutationFn,
        isPending: false,
        isError: false,
    }),
    useQueryClient: () => ({
        clear: mockClear,
    }),
    queryOptions: (opts: any) => opts,
}));

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => mockNavigate,
}));

vi.mock("@sentry/react", () => ({
    setUser: vi.fn(),
}));

import * as Sentry from "@sentry/react";

import { useLogout, useTelegramLogin, useUpdateLanguage } from "../use-auth";

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
        mockNavigate.mockClear();
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

    test("should navigate to home on successful login", async () => {
        const { result } = renderHook(() => useTelegramLogin());
        await result.current.mutate(loginBody);

        expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
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
        await expect(result.current.mutate(loginBody)).rejects.toThrow("Network error");
    });

    test("should throw on unsuccessful response", async () => {
        mockTelegramPost.mockResolvedValueOnce({
            data: { success: false },
            error: null,
        });

        const { result } = renderHook(() => useTelegramLogin());
        await expect(result.current.mutate(loginBody)).rejects.toThrow("Request failed");

        expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    test("should convert numeric id to string", async () => {
        const bodyWithNumId = { ...loginBody, id: 456 as any };
        const { result } = renderHook(() => useTelegramLogin());
        await result.current.mutate(bodyWithNumId);

        expect(mockTelegramPost).toHaveBeenCalledWith(expect.objectContaining({ id: "456" }));
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

    test("should show error toast on API error", async () => {
        mockTelegramPost.mockResolvedValueOnce({
            data: null,
            error: new Error("Network error"),
        });

        const { result } = renderHook(() => useTelegramLogin());
        try {
            await result.current.mutate(loginBody);
        } catch {
            // expected
        }

        expect(mockToastError).toHaveBeenCalledWith("error");
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
        mockNavigate.mockClear();
        mockClear.mockClear();
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

    test("should clear query client on logout", async () => {
        const { result } = renderHook(() => useLogout());
        await result.current.mutate();

        expect(mockClear).toHaveBeenCalled();
    });

    test("should navigate to login page on settled", async () => {
        const { result } = renderHook(() => useLogout());
        await result.current.mutate();

        expect(mockNavigate).toHaveBeenCalledWith({ to: "/login" });
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
        await expect(result.current.mutate("ru")).rejects.toThrow("Unauthorized");
    });

    test("should show error toast on API error", async () => {
        mockLanguagePut.mockResolvedValueOnce({
            data: null,
            error: new Error("Unauthorized"),
        });

        const { result } = renderHook(() => useUpdateLanguage());
        try {
            await result.current.mutate("ru");
        } catch {
            // expected
        }

        expect(mockToastError).toHaveBeenCalledWith("error");
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
