import { create } from "zustand";

interface UserAccount {
    id: number;
    name: string;
    telegramId: string;
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

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    user: null,
    isAuthenticated: false,

    setToken: (token) => set({ token }),
    setUser: (user) => set({ user }),
    login: (token, user) => set({ token, user, isAuthenticated: true }),
    logout: () => set({ token: null, user: null, isAuthenticated: false }),
}));
