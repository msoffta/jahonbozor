import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Edit3, ClipboardList, ShoppingCart, Globe, LogOut } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useUIStore } from "@/stores/ui.store";
import { profileOptions, useLogout, useUpdateLanguage } from "@/api/auth.api";
import { Avatar, AvatarFallback, AvatarImage } from "@jahonbozor/ui";

function ProfilePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const locale = useUIStore((s) => s.locale);
    const setLocale = useUIStore((s) => s.setLocale);
    const logout = useLogout();
    const updateLanguage = useUpdateLanguage();

    const { data: profileData } = useQuery(profileOptions());
    const profile = profileData?.data as {
        fullname?: string;
        username?: string;
        phone?: string;
        photo?: string | null;
        createdAt?: string;
    } | undefined;

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
        <div className="flex flex-col items-center px-4 py-6">
            <Avatar className="h-32 w-32">
                {profile?.photo && <AvatarImage src={profile.photo} alt={displayName} />}
                <AvatarFallback className="text-3xl">{initials}</AvatarFallback>
            </Avatar>

            <h2 className="mt-3 text-3xl font-bold">{displayName}</h2>
            {username && <p className="text-base font-medium text-black">@{username}</p>}
            {user?.telegramId && (
                <p className="text-xs font-light">ID: {user.telegramId}</p>
            )}
            {profile?.createdAt && (
                <p className="text-base font-normal">
                    {t("registered")}: {new Date(profile.createdAt).toLocaleDateString("ru-RU")}
                </p>
            )}

            <div className="mt-6 w-full space-y-2.5">
                {/* TODO: edit profile
                <button
                    type="button"
                    disabled
                    className="flex w-full items-center gap-2 rounded-lg bg-accent px-3 py-3 opacity-50"
                >
                    <Edit3 className="h-5 w-5 text-accent-foreground" />
                    <span className="text-base font-medium text-accent-foreground">{t("edit_profile")}</span>
                </button>
                */}

                <button
                    type="button"
                    onClick={() => navigate({ to: "/orders" })}
                    className="flex w-full items-center gap-2 rounded-lg bg-accent px-3 py-3"
                >
                    <ClipboardList className="h-5 w-5 text-accent-foreground" />
                    <span className="text-base font-medium text-accent-foreground">{t("orders")}</span>
                </button>

                <button
                    type="button"
                    onClick={() => navigate({ to: "/cart" })}
                    className="flex w-full items-center gap-2 rounded-lg bg-accent px-3 py-3"
                >
                    <ShoppingCart className="h-5 w-5 text-accent-foreground" />
                    <span className="text-base font-medium text-accent-foreground">{t("cart")}</span>
                </button>

                <button
                    type="button"
                    onClick={handleChangeLanguage}
                    className="flex w-full items-center gap-2 rounded-lg bg-accent px-3 py-3"
                >
                    <Globe className="h-5 w-5 text-accent-foreground" />
                    <span className="text-base font-medium text-accent-foreground">
                        {t("change_language")} ({locale === "uz" ? "RU" : "UZ"})
                    </span>
                </button>

                <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg bg-accent px-3 py-3"
                >
                    <LogOut className="h-5 w-5 text-accent-foreground" />
                    <span className="text-base font-medium text-accent-foreground">{t("logout")}</span>
                </button>
            </div>
        </div>
    );
}

export const Route = createFileRoute("/_user/profile")({
    component: ProfilePage,
});
