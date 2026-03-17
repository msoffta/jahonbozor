import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ClipboardList, ShoppingCart, Globe, LogOut } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useUIStore } from "@/stores/ui.store";
import { profileOptions, useLogout, useUpdateLanguage } from "@/api/auth.api";
import { Avatar, AvatarFallback, AvatarImage, PageTransition, motion } from "@jahonbozor/ui";
import { getLocaleCode } from "@/lib/format";

function ProfilePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const locale = useUIStore((state) => state.locale);
    const setLocale = useUIStore((state) => state.setLocale);
    const logout = useLogout();
    const updateLanguage = useUpdateLanguage();

    const { data: profile } = useQuery(profileOptions());

    const displayName = profile?.fullname ?? user?.name ?? "User";
    const username = profile?.username ?? "";
    const initials = displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

    const handleChangeLanguage = () => {
        const newLocale = locale === "uz" ? "ru" : "uz";
        setLocale(newLocale);
        if (isAuthenticated) {
            updateLanguage.mutate(newLocale);
        }
    };

    const handleLogout = () => {
        logout.mutate(undefined, {
            onSettled: () => {
                navigate({ to: "/login" });
            },
        });
    };

    return (
        <PageTransition className="flex flex-col items-center px-4 py-6">
            <Avatar className="h-32 w-32">
                {profile?.photo && <AvatarImage src={profile.photo} alt={displayName} />}
                <AvatarFallback className="text-3xl">{initials}</AvatarFallback>
            </Avatar>

            <h2 className="mt-3 text-3xl font-bold">{displayName}</h2>
            {username && <p className="text-base font-medium text-foreground">@{username}</p>}
            {user?.telegramId && (
                <p className="text-xs font-light">ID: {user.telegramId}</p>
            )}
            {profile?.createdAt && (
                <p className="text-base font-normal">
                    {t("registered")}: {new Date(profile.createdAt).toLocaleDateString(getLocaleCode(locale))}
                </p>
            )}

            <div className="mt-6 w-full space-y-2.5">
                <motion.button
                    type="button"
                    onClick={() => navigate({ to: "/orders" })}
                    className="flex w-full items-center gap-2 rounded-lg bg-accent px-3 py-3"
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    <ClipboardList className="h-5 w-5 text-accent-foreground" />
                    <span className="text-base font-medium text-accent-foreground">{t("orders")}</span>
                </motion.button>

                <motion.button
                    type="button"
                    onClick={() => navigate({ to: "/cart" })}
                    className="flex w-full items-center gap-2 rounded-lg bg-accent px-3 py-3"
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    <ShoppingCart className="h-5 w-5 text-accent-foreground" />
                    <span className="text-base font-medium text-accent-foreground">{t("cart")}</span>
                </motion.button>

                <motion.button
                    type="button"
                    onClick={handleChangeLanguage}
                    className="flex w-full items-center gap-2 rounded-lg bg-accent px-3 py-3"
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    <Globe className="h-5 w-5 text-accent-foreground" />
                    <span className="text-base font-medium text-accent-foreground">
                        {t("change_language")} ({locale === "uz" ? "RU" : "UZ"})
                    </span>
                </motion.button>

                <motion.button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg bg-accent px-3 py-3"
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    <LogOut className="h-5 w-5 text-accent-foreground" />
                    <span className="text-base font-medium text-accent-foreground">{t("logout")}</span>
                </motion.button>
            </div>
        </PageTransition>
    );
}

export const Route = createFileRoute("/_user/profile")({
    component: ProfilePage,
});
