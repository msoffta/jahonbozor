import { Home } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@jahonbozor/ui";
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
                <button
                    type="button"
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold uppercase text-foreground"
                >
                    {t("list")}
                </button>
                <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-lg font-semibold text-foreground"
                >
                    +
                </button>
            </div>

            <Link
                to="/"
                className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    pathname === "/"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground",
                )}
            >
                <Home className="h-5 w-5" />
            </Link>

            <div className="flex flex-1 items-center justify-end gap-1.5">
                {navKeys.map((item) => {
                    const isActive = pathname.startsWith(item.to);
                    return (
                        <Link
                            key={item.to}
                            to={item.to}
                            className={cn(
                                "rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase",
                                isActive
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border text-foreground",
                            )}
                        >
                            {t(item.key)}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
