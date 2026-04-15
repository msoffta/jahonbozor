import { treaty } from "@elysiajs/eden";
import * as Sentry from "@sentry/react";

import { useAuthStore } from "@/stores/auth.store";
import { useUIStore } from "@/stores/ui.store";

import type { App } from "@jahonbozor/backend";

interface RefreshResponse {
    success?: boolean;
    data?: { token?: string };
}

interface ProfileResponse {
    success?: boolean;
    data?: {
        id: number;
        fullname: string;
        telegramId: string | number;
        phone: string | null;
        language: string;
    };
}

let isRefreshing = false;

export const api = treaty<App>(window.location.origin, {
    headers() {
        const { token } = useAuthStore.getState();
        if (token) {
            return { Authorization: `Bearer ${token}` };
        }
    },
    onResponse(response) {
        if (
            response.status === 401 &&
            !isRefreshing &&
            !response.url.includes("/users/refresh") &&
            !response.url.includes("/auth/me")
        ) {
            void tryRefreshToken();
        }
    },
    fetch: {
        credentials: "include",
    },
});

export async function tryRefreshToken(): Promise<boolean> {
    if (isRefreshing) return false;
    isRefreshing = true;

    try {
        const response = await fetch("/api/public/users/refresh", {
            method: "POST",
            credentials: "include",
        });

        if (!response.ok) {
            useAuthStore.getState().logout();
            Sentry.setUser(null);
            return false;
        }

        const data: RefreshResponse = (await response.json()) as RefreshResponse;
        if (!data.success || !data.data?.token) {
            useAuthStore.getState().logout();
            Sentry.setUser(null);
            return false;
        }

        const token = data.data.token;
        useAuthStore.getState().setToken(token);

        // Fetch user profile to populate full auth state
        const profileResponse = await fetch("/api/public/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!profileResponse.ok) {
            useAuthStore.getState().logout();
            Sentry.setUser(null);
            return false;
        }

        const profileData: ProfileResponse = (await profileResponse.json()) as ProfileResponse;
        if (profileData.success && profileData.data) {
            const profile = profileData.data;
            const language = profile.language === "ru" ? "ru" : "uz";
            useAuthStore.getState().login(token, {
                id: profile.id,
                name: profile.fullname,
                telegramId: String(profile.telegramId),
                phone: profile.phone ?? null,
                language,
                type: "user",
            });
            useUIStore.getState().setLocale(language);
            Sentry.setUser({ id: String(profile.id), username: profile.fullname });
            return true;
        }

        useAuthStore.getState().logout();
        Sentry.setUser(null);
        return false;
    } catch {
        useAuthStore.getState().logout();
        Sentry.setUser(null);
        return false;
    } finally {
        isRefreshing = false;
    }
}
