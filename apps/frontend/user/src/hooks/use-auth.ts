import * as Sentry from "@sentry/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { toast } from "@jahonbozor/ui";

import { api } from "@/lib/api-client";
import { unwrap, unwrapRaw } from "@/lib/eden-utils";
import { i18n } from "@/lib/i18n";
import { useAuthStore } from "@/stores/auth.store";
import { useUIStore } from "@/stores/ui.store";

interface TelegramLoginResponse {
    token: string;
    user: {
        id: number;
        fullname: string;
        telegramId: string;
        phone: string | null;
        language: string;
    };
}

export function useTelegramLogin() {
    const navigate = useNavigate();

    return useMutation({
        mutationFn: async (body: {
            id: string | number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
            auth_date: number;
            hash: string;
        }): Promise<TelegramLoginResponse> => {
            const language = useUIStore.getState().locale;
            return unwrap(
                await api.api.public.users.telegram.post({
                    ...body,
                    id: String(body.id),
                    language,
                }),
            );
        },
        onSuccess: ({ token, user }) => {
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
            Sentry.setUser({ id: String(user.id), username: user.fullname });
            void navigate({ to: "/" });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
}

export function useUpdateLanguage() {
    return useMutation({
        mutationFn: async (language: "uz" | "ru") =>
            unwrapRaw(await api.api.public.users.language.put({ language })),
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
}

export function useLogout() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            unwrapRaw(await api.api.public.auth.logout.post());
        },
        onSettled: () => {
            useAuthStore.getState().logout();
            Sentry.setUser(null);
            queryClient.clear();
            void navigate({ to: "/login" });
        },
    });
}
