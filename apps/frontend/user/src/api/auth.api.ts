import { queryOptions, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { useUIStore } from "@/stores/ui.store";

export const authKeys = {
    me: ["auth", "me"] as const,
};

export const profileOptions = () =>
    queryOptions({
        queryKey: authKeys.me,
        queryFn: async () => {
            const { data, error } = await api.api.public.auth.me.get();
            if (error) throw error;
            return data;
        },
        enabled: useAuthStore.getState().isAuthenticated,
    });

export function useTelegramLogin() {
    return useMutation({
        mutationFn: async (body: {
            id: string | number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
            auth_date: number;
            hash: string;
        }) => {
            const language = useUIStore.getState().locale;
            const { data, error } = await api.api.public.users.telegram.post({
                ...body,
                id: String(body.id),
                language,
            });
            if (error) throw error;
            return data;
        },
        onSuccess: (result) => {
            if (result && result.success && result.data) {
                const { token, user } = result.data;
                const language = user.language === "ru" ? "ru" : "uz";
                useAuthStore.getState().login(token, {
                    id: user.id,
                    name: user.fullname,
                    telegramId: String(user.telegramId),
                    phone: user.phone ?? null,
                    language,
                    type: "user",
                });
                useUIStore.getState().setLocale(language);
            }
        },
    });
}

export function useUpdateLanguage() {
    return useMutation({
        mutationFn: async (language: "uz" | "ru") => {
            const { data, error } = await api.api.public.users.language.put({ language });
            if (error) throw error;
            return data;
        },
    });
}

export function useLogout() {
    return useMutation({
        mutationFn: async () => {
            const { error } = await api.api.public.auth.logout.post();
            if (error) throw error;
        },
        onSettled: () => {
            useAuthStore.getState().logout();
        },
    });
}
