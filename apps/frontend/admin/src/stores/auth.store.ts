import { create } from "zustand";
import type { Permission } from "@jahonbozor/schemas";

interface StaffUser {
    id: number;
    name: string;
    login: string;
    type: "staff";
    permissions: Permission[];
}

interface AuthState {
    token: string | null;
    user: StaffUser | null;
    isAuthenticated: boolean;

    setToken: (token: string) => void;
    setUser: (user: StaffUser) => void;
    login: (token: string, user: StaffUser) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    user: null,
    isAuthenticated: false,

    setToken: (token) => set({ token }),
    setUser: (user) => set({ user }),
    login: (token, user) => set({ token, user, isAuthenticated: true }),
    logout: () => set({ token: null, user: null, isAuthenticated: false }),
}));
