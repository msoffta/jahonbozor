import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Permission, TokenStaff } from "@jahonbozor/schemas";

interface AuthState {
    token: string | null;
    user: TokenStaff | null;
    permissions: Permission[];
    isAuthenticated: boolean;

    setAuth: (token: string, user: TokenStaff, permissions: Permission[]) => void;
    clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            user: null,
            permissions: [],
            isAuthenticated: false,

            setAuth: (token, user, permissions) =>
                set({ token, user, permissions, isAuthenticated: true }),

            clearAuth: () =>
                set({ token: null, user: null, permissions: [], isAuthenticated: false }),
        }),
        {
            name: "admin-auth",
            partialize: (state) => ({
                token: state.token,
                user: state.user,
                permissions: state.permissions,
                isAuthenticated: state.isAuthenticated,
            }),
        },
    ),
);
