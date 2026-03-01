import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserAccount {
    id: number;
    name: string;
    telegramId: string;
    phone: string | null;
    language: "uz" | "ru";
    type: "user";
}

interface AuthState {
    token: string | null;
    user: UserAccount | null;
    isAuthenticated: boolean;

    setToken: (token: string) => void;
    setUser: (user: UserAccount) => void;
    login: (token: string, user: UserAccount) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            user: null,
            isAuthenticated: false,

            setToken: (token) => set({ token }),
            setUser: (user) => set({ user }),
            login: (token, user) => set({ token, user, isAuthenticated: true }),
            logout: () => set({ token: null, user: null, isAuthenticated: false }),
        }),
        {
            name: "auth",
            partialize: (state) => ({
                token: state.token,
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        },
    ),
);
