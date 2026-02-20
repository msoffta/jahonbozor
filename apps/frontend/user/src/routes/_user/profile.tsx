import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Edit3, ClipboardList, ShoppingCart, Globe, LogOut } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useUIStore } from "@/stores/ui.store";
import { profileOptions, useLogout } from "@/api/auth.api";
import { Avatar, AvatarFallback, AvatarImage, Button } from "@jahonbozor/ui";
import i18n from "@/lib/i18n";

function ProfilePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const locale = useUIStore((s) => s.locale);
    const setLocale = useUIStore((s) => s.setLocale);
    const logout = useLogout();

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
        i18n.changeLanguage(newLocale);
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
            <Avatar className="h-20 w-20">
                {profile?.photo && <AvatarImage src={profile.photo} alt={displayName} />}
                <AvatarFallback className="text-xl">{initials}</AvatarFallback>
            </Avatar>

            <h2 className="mt-3 text-lg font-bold">{displayName}</h2>
            {username && <p className="text-sm text-muted-foreground">@{username}</p>}
            {profile?.createdAt && (
                <p className="text-xs text-muted-foreground">
                    {t("registered")}: {new Date(profile.createdAt).toLocaleDateString("ru-RU")}
                </p>
            )}

            <div className="mt-6 w-full space-y-3">
                <Button
                    variant="default"
                    className="w-full justify-start gap-3"
                    disabled
                >
                    <Edit3 className="h-4 w-4" />
                    {t("edit_profile")}
                </Button>

                <Button
                    variant="default"
                    className="w-full justify-start gap-3"
                    onClick={() => navigate({ to: "/orders" })}
                >
                    <ClipboardList className="h-4 w-4" />
                    {t("orders")}
                </Button>

                <Button
                    variant="default"
                    className="w-full justify-start gap-3"
                    onClick={() => navigate({ to: "/cart" })}
                >
                    <ShoppingCart className="h-4 w-4" />
                    {t("cart")}
                </Button>

                <Button
                    variant="default"
                    className="w-full justify-start gap-3"
                    onClick={handleChangeLanguage}
                >
                    <Globe className="h-4 w-4" />
                    {t("change_language")} ({locale === "uz" ? "RU" : "UZ"})
                </Button>
            </div>

            <Button
                variant="outline"
                className="mt-6 w-full gap-2"
                onClick={handleLogout}
            >
                <LogOut className="h-4 w-4" />
                {t("logout")}
            </Button>
        </div>
    );
}

export const Route = createFileRoute("/_user/profile")({
    component: ProfilePage,
});
