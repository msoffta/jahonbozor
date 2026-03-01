import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, LogOut, Settings, User } from "lucide-react";
import {
    cn,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@jahonbozor/ui";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth.store";
import { useLogout } from "@/hooks/use-auth";

export function Header() {
    const [scrolled, setScrolled] = useState(false);
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user);
    const { mutate: logout } = useLogout();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header
            className={cn(
                "sticky top-0 z-50 flex h-14 items-center justify-between px-4 transition-all duration-200",
                scrolled ? "bg-surface shadow-sm" : "bg-surface/80",
            )}
        >
            <Link to="/">
                <img src="/logo.svg" alt="Jahon Bozor" className="h-8" />
            </Link>

            <div className="flex items-center gap-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button type="button" className="relative">
                            <Bell className="h-5 w-5 text-foreground" />
                            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                                1
                            </span>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuLabel>
                            {t("notifications")}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                            {t("no_notifications")}
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button type="button">
                            <User className="h-5 w-5 text-foreground" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {user && (
                            <>
                                <DropdownMenuLabel>
                                    {user.fullname}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                            </>
                        )}
                        <DropdownMenuItem asChild>
                            <Link to="/profile">
                                <User className="h-4 w-4" />
                                {t("profile")}
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link to="/settings">
                                <Settings className="h-4 w-4" />
                                {t("settings")}
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => logout()}>
                            <LogOut className="h-4 w-4" />
                            {t("logout")}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
