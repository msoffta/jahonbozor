import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { useAuthStore } from "@/stores/auth.store";
import { useUIStore } from "@/stores/ui.store";

mock.module("@sentry/react", () => ({
    setUser: mock(),
}));

import * as Sentry from "@sentry/react";
import { tryRefreshToken } from "../api-client";

const mockUser = {
    id: 1,
    name: "Test",
    telegramId: "123",
    phone: null,
    language: "uz" as const,
    type: "user" as const,
};

describe("api-client", () => {
    beforeEach(() => {
        useAuthStore.setState({ token: null, user: null, isAuthenticated: false });
        useUIStore.setState({ locale: "uz" });
        (Sentry.setUser as ReturnType<typeof mock>).mockClear();
    });

    afterEach(() => {
        mock.restore();
    });

    describe("tryRefreshToken", () => {
        test("should login with full profile on successful refresh", async () => {
            const profileData = {
                id: 1,
                fullname: "Test User",
                telegramId: 123,
                phone: "+998901234567",
                language: "ru",
            };

            const fetchSpy = spyOn(globalThis, "fetch")
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ success: true, data: { token: "new-token" } }),
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ success: true, data: profileData }),
                } as Response);

            const result = await tryRefreshToken();

            expect(result).toBe(true);
            expect(fetchSpy).toHaveBeenCalledTimes(2);
            expect(fetchSpy).toHaveBeenCalledWith("/api/public/auth/refresh", {
                method: "POST",
                credentials: "include",
            });
            expect(fetchSpy).toHaveBeenCalledWith("/api/public/auth/me", {
                headers: { Authorization: "Bearer new-token" },
            });

            const state = useAuthStore.getState();
            expect(state.token).toBe("new-token");
            expect(state.isAuthenticated).toBe(true);
            expect(state.user?.name).toBe("Test User");
            expect(state.user?.telegramId).toBe("123");
            expect(state.user?.language).toBe("ru");

            expect(useUIStore.getState().locale).toBe("ru");
            expect(Sentry.setUser).toHaveBeenCalledWith({ id: "1", username: "Test User" });
        });

        test("should logout on non-ok refresh response", async () => {
            useAuthStore.getState().login("old-token", mockUser);

            spyOn(globalThis, "fetch").mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({}),
            } as Response);

            const result = await tryRefreshToken();

            expect(result).toBe(false);
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
            expect(useAuthStore.getState().token).toBeNull();
            expect(Sentry.setUser).toHaveBeenCalledWith(null);
        });

        test("should logout when refresh response has no token", async () => {
            useAuthStore.getState().login("old-token", mockUser);

            spyOn(globalThis, "fetch").mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: false }),
            } as Response);

            const result = await tryRefreshToken();

            expect(result).toBe(false);
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
            expect(Sentry.setUser).toHaveBeenCalledWith(null);
        });

        test("should logout when profile fetch fails", async () => {
            spyOn(globalThis, "fetch")
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ success: true, data: { token: "new-token" } }),
                } as Response)
                .mockResolvedValueOnce({
                    ok: false,
                    json: () => Promise.resolve({}),
                } as Response);

            const result = await tryRefreshToken();

            expect(result).toBe(false);
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
            expect(Sentry.setUser).toHaveBeenCalledWith(null);
        });

        test("should logout on fetch error", async () => {
            useAuthStore.getState().login("old-token", mockUser);

            spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

            const result = await tryRefreshToken();

            expect(result).toBe(false);
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
            expect(Sentry.setUser).toHaveBeenCalledWith(null);
        });

        test("should default language to uz when not ru", async () => {
            const profileData = {
                id: 1,
                fullname: "Test",
                telegramId: 1,
                phone: null,
                language: "en",
            };

            spyOn(globalThis, "fetch")
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ success: true, data: { token: "t" } }),
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ success: true, data: profileData }),
                } as Response);

            await tryRefreshToken();

            expect(useAuthStore.getState().user?.language).toBe("uz");
            expect(useUIStore.getState().locale).toBe("uz");
        });
    });

    describe("headers", () => {
        test("should include Authorization header when token exists", () => {
            useAuthStore.getState().setToken("test-token");

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
