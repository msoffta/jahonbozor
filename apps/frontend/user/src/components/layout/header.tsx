import { useEffect, useState } from "react";

import { Link } from "@tanstack/react-router";
import { User } from "lucide-react";

import { cn, motion } from "@jahonbozor/ui";

export function Header() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header
            className={cn(
                "sticky top-0 z-50 flex h-14 items-center justify-center px-4 transition-all duration-200",
                scrolled ? "bg-surface shadow-sm" : "bg-surface/80",
            )}
        >
            <motion.div
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
                <Link to="/">
                    <img src="/logo.svg" alt="Jahon Bozor" className="h-8" />
                </Link>
            </motion.div>

            <div className="absolute right-4 flex items-center gap-3">
                <motion.div
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    <Link to="/profile">
                        <User className="text-foreground h-5 w-5" />
                    </Link>
                </motion.div>
            </div>
        </header>
    );
}
