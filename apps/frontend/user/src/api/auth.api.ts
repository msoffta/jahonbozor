import { queryOptions } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { unwrap } from "@/lib/eden-utils";
import { useAuthStore } from "@/stores/auth.store";

export const authKeys = {
    me: ["auth", "me"] as const,
};

export interface UserProfile {
    id: number;
    fullname: string;
    username?: string;
    telegramId: string | number;
    phone?: string | null;
    photo?: string | null;
    language: string;
    createdAt: Date | string;
}

export const profileOptions = (params?: { enabled?: boolean }) =>
    queryOptions({
        queryKey: authKeys.me,
        queryFn: async (): Promise<UserProfile> => unwrap(await api.api.public.auth.me.get()),
        enabled: params?.enabled ?? useAuthStore.getState().isAuthenticated,
    });
