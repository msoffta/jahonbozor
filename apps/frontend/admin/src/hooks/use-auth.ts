import * as Sentry from "@sentry/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth.store";

import type { Permission } from "@jahonbozor/schemas";
import type { ProfileResponse } from "@jahonbozor/schemas/src/auth/auth.dto";

export function useLogin() {
    const setAuth = useAuthStore((state) => state.setAuth);
    const navigate = useNavigate();

    return useMutation({
        mutationFn: async (body: { username: string; password: string }) => {
            const { data: res, error } = await api.api.public.auth.login.post(body);
            if (error || !res?.success || !res.data) {
                throw new Error("Login failed");
            }
            return res.data;
        },
        onSuccess: async (result) => {
            const { staff, token } = result;

            // Raw fetch used intentionally to avoid circular dependency (auth hook ↔ auth-dependent client)
            const profileResponse = await fetch("/api/public/auth/me", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const profileData: ProfileResponse | null = profileResponse.ok
                ? ((await profileResponse.json()) as ProfileResponse)
                : null;
            const profile = profileData?.success ? profileData.data : null;
            const permissions: Permission[] =
                profile && "role" in profile && profile.role != null
                    ? (profile.role.permissions as Permission[])
                    : [];

            setAuth(
                token,
                {
                    id: staff.id,
                    fullname: staff.fullname,
                    username: staff.username,
                    roleId: staff.roleId,
                    type: "staff",
                },
                permissions,
            );
            Sentry.setUser({ id: String(staff.id), username: staff.fullname });
            void navigate({ to: "/" });
        },
    });
}

export function useLogout() {
    const clearAuth = useAuthStore((state) => state.clearAuth);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            await api.api.public.auth.logout.post();
        },
        onSettled: () => {
            clearAuth();
            Sentry.setUser(null);
            queryClient.clear();
            void navigate({ to: "/login" });
        },
    });
}
