import { create } from "zustand";
import { persist } from "zustand/middleware";

type Locale = "uz" | "ru";

interface UIState {
    locale: Locale;
    setLocale: (locale: Locale) => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            locale: "uz",
            setLocale: (locale) => set({ locale }),
        }),
        {
            name: "user-ui-store",
            partialize: (state) => ({ locale: state.locale }),
        },
    ),
);
