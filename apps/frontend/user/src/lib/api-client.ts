import { treaty } from "@elysiajs/eden";
import type { App } from "@jahonbozor/backend";
import { useAuthStore } from "@/stores/auth.store";
import { useUIStore } from "@/stores/ui.store";

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
            useAuthStore.getState().logout();
            return false;
        }

        const data = await response.json();
        if (!data.success || !data.data?.token) {
            useAuthStore.getState().logout();
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
            return false;
        }

        const profileData = await profileResponse.json();
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
            return true;
        }

        useAuthStore.getState().logout();
        return false;
    } catch {
        useAuthStore.getState().logout();
        return false;
    } finally {
        isRefreshing = false;
    }
}
