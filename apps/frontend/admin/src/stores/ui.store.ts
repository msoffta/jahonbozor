import { create } from "zustand";
import { persist } from "zustand/middleware";

type Locale = "uz" | "ru";

interface UIState {
    sidebarOpen: boolean;
    locale: Locale;

    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
    setLocale: (locale: Locale) => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            sidebarOpen: true,
            locale: "uz",

            toggleSidebar: () =>
                set((state) => ({ sidebarOpen: !state.sidebarOpen })),
            setSidebarOpen: (open) => set({ sidebarOpen: open }),
            setLocale: (locale) => set({ locale }),
        }),
        {
            name: "admin-ui-store",
            partialize: (state) => ({
                sidebarOpen: state.sidebarOpen,
                locale: state.locale,
            }),
        },
    ),
);
