import { treaty } from "@elysiajs/eden";
import * as Sentry from "@sentry/react";

import { useAuthStore } from "@/stores/auth.store";

import type { App } from "@jahonbozor/backend";

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
            !response.url.includes("/auth/refresh") &&
            !response.url.includes("/auth/me")
        ) {
            tryRefreshToken();
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
        const response = await fetch("/api/public/auth/refresh", {
            method: "POST",
            credentials: "include",
        });

        if (!response.ok) {
            useAuthStore.getState().clearAuth();
            Sentry.setUser(null);
            return false;
        }

        const data = await response.json();
        if (!data.success || !data.data?.token) {
            useAuthStore.getState().clearAuth();
            Sentry.setUser(null);
            return false;
        }

        const token = data.data.token;

        const profileResponse = await fetch("/api/public/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!profileResponse.ok) {
            useAuthStore.getState().clearAuth();
            Sentry.setUser(null);
            return false;
        }

        const profileData = await profileResponse.json();
        if (profileData.success && profileData.data) {
            const profile = profileData.data;
            useAuthStore.getState().setAuth(
                token,
                {
                    id: profile.id,
                    fullname: profile.fullname,
                    username: profile.username,
                    roleId: profile.roleId,
                    type: "staff",
                },
                profile.role?.permissions ?? [],
            );
            Sentry.setUser({ id: String(profile.id), username: profile.fullname });
            return true;
        }

        useAuthStore.getState().clearAuth();
        Sentry.setUser(null);
        return false;
    } catch {
        useAuthStore.getState().clearAuth();
        Sentry.setUser(null);
        return false;
    } finally {
        isRefreshing = false;
    }
}
