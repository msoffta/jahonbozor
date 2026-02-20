import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { cn, motion } from "@jahonbozor/ui";
import { useUIStore } from "@/stores/ui.store";

export function Header() {
    const [scrolled, setScrolled] = useState(false);
    const hasNotifications = false; // TODO: connect to real notification state
    const locale = useUIStore((s) => s.locale);
    const setLocale = useUIStore((s) => s.setLocale);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const toggleLocale = () => setLocale(locale === "uz" ? "ru" : "uz");

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

            <div className="flex items-center gap-2">
                <motion.button
                    type="button"
                    onClick={toggleLocale}
                    className="h-9 rounded-full bg-surface px-3 text-xs font-bold uppercase text-foreground"
                    whileTap={{ scale: 0.9, opacity: 0.8 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    {locale === "uz" ? "Ру" : "Uz"}
                </motion.button>

                <motion.button
                    type="button"
                    className="relative bg-accent w-9 h-9 flex items-center justify-center rounded-full"
                    whileTap={{ scale: 0.9, opacity: 0.8 }}
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    <Bell className="text-accent-foreground h-5 w-5" />
                    {hasNotifications && (
                        <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-surface" />
                    )}
                </motion.button>
            </div>
        </header>
    );
}
