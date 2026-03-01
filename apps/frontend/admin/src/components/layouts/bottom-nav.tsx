import { Home } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn, motion, LayoutGroup } from "@jahonbozor/ui";
import { useTranslation } from "react-i18next";

const navKeys = [
    { to: "/income", key: "income" },
    { to: "/users", key: "clients" },
    { to: "/expense", key: "expense" },
    { to: "/products", key: "warehouse" },
    { to: "/summary", key: "summary" },
] as const;

export function BottomNav() {
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const { t } = useTranslation();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-t border-border bg-surface px-2">
            <div className="flex flex-1 items-center gap-1.5">
                <motion.button
                    type="button"
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold uppercase text-foreground"
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    {t("list")}
                </motion.button>
                <motion.button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-lg font-semibold text-foreground"
                    whileTap={{ scale: 0.9, rotate: 90 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    +
                </motion.button>
            </div>

            <Link to="/" className="shrink-0">
                <motion.div
                    className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl",
                        pathname === "/"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground",
                    )}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    <Home className="h-5 w-5" />
                </motion.div>
            </Link>

            <LayoutGroup>
                <div className="flex flex-1 items-center justify-end gap-1.5">
                    {navKeys.map((item) => {
                        const isActive = pathname.startsWith(item.to);
                        return (
                            <Link key={item.to} to={item.to} className="relative">
                                {isActive && (
                                    <motion.div
                                        layoutId="activeNavPill"
                                        className="absolute inset-0 rounded-lg bg-primary"
                                        transition={{
                                            type: "spring",
                                            stiffness: 400,
                                            damping: 30,
                                        }}
                                    />
                                )}
                                <span
                                    className={cn(
                                        "relative z-10 block px-3 py-1.5 text-xs font-semibold uppercase",
                                        isActive
                                            ? "text-primary-foreground"
                                            : "rounded-lg border border-border text-foreground",
                                    )}
                                >
                                    {t(item.key)}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </LayoutGroup>
        </nav>
    );
}
