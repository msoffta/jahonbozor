import { treaty } from "@elysiajs/eden";
import type { App } from "@jahonbozor/backend";
import { useAuthStore } from "@/stores/auth.store";

export const api = treaty<App>(window.location.origin, {
    headers() {
        const { token } = useAuthStore.getState();
        if (token) {
            return { Authorization: `Bearer ${token}` };
        }
    },
    onResponse(response) {
        if (response.status === 401) {
            tryRefreshToken();
        }
    },
    fetch: {
        credentials: "include",
    },
});

async function tryRefreshToken(): Promise<void> {
    try {
        const response = await fetch("/api/public/auth/refresh", {
            method: "POST",
            credentials: "include",
        });

        if (!response.ok) {
            useAuthStore.getState().logout();
            return;
        }

        const data = await response.json();
        if (data.success && data.data?.token) {
            useAuthStore.getState().setToken(data.data.token);
        } else {
            useAuthStore.getState().logout();
        }
    } catch {
        useAuthStore.getState().logout();
    }
}
