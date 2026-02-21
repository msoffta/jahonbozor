import { useEffect, useState } from "react";
import { cn, motion } from "@jahonbozor/ui";
import { useUIStore } from "@/stores/ui.store";
import { useAuthStore } from "@/stores/auth.store";
import { useUpdateLanguage } from "@/api/auth.api";

export function Header() {
    const [scrolled, setScrolled] = useState(false);
    const locale = useUIStore((s) => s.locale);
    const setLocale = useUIStore((s) => s.setLocale);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const updateLanguage = useUpdateLanguage();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const toggleLocale = () => {
        const newLocale = locale === "uz" ? "ru" : "uz";
        setLocale(newLocale);
        if (isAuthenticated) {
            updateLanguage.mutate(newLocale);
        }
    };

    return (
        <header
            className={cn(
                "sticky top-0 z-50 flex h-14 items-center justify-between px-4 transition-all duration-200",
                scrolled
                    ? "bg-surface shadow-sm"
                    : "bg-transparent",
            )}
        >
            <img src="/logo.svg" alt="Jahon Bozor" />

            <motion.button
                type="button"
                onClick={toggleLocale}
                className="h-9 rounded-full bg-surface px-3 text-xs font-bold uppercase text-foreground"
                whileTap={{ scale: 0.9, opacity: 0.8 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
                {locale === "uz" ? "Ру" : "Uz"}
            </motion.button>
        </header>
    );
}
