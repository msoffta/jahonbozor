import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClipboardList, Globe, LogOut, ShoppingCart, Wallet } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage, motion, PageTransition } from "@jahonbozor/ui";

import { profileOptions } from "@/api/auth.api";
import { myDebtSummaryOptions } from "@/api/debts.api";
import { useLogout, useUpdateLanguage } from "@/hooks/use-auth";
import { formatDate, getLocaleCode } from "@/lib/format";
import { useAuthStore } from "@/stores/auth.store";
import { useUIStore } from "@/stores/ui.store";

function ProfilePage() {
    const { t } = useTranslation("profile");
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const locale = useUIStore((state) => state.locale);
    const setLocale = useUIStore((state) => state.setLocale);
    const logout = useLogout();
    const updateLanguage = useUpdateLanguage();

    const { data: profile } = useQuery(profileOptions());
    const { data: debtSummary } = useQuery(myDebtSummaryOptions());

    const displayName = profile?.fullname ?? user?.name ?? "User";
    const username = profile?.username ?? "";
    const initials = displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    const localeCode = getLocaleCode(locale);

    const handleChangeLanguage = () => {
        const newLocale = locale === "uz" ? "ru" : "uz";
        setLocale(newLocale);
        if (isAuthenticated) {
            updateLanguage.mutate(newLocale);
        }
    };

    const menuItems = [
        {
            key: "orders",
            icon: ClipboardList,
            label: t("orders"),
            onClick: () => navigate({ to: "/orders" }),
        },
        {
            key: "cart",
            icon: ShoppingCart,
            label: t("cart"),
            onClick: () => navigate({ to: "/cart" }),
        },
        {
            key: "language",
            icon: Globe,
            label: `${t("change_language")} (${locale === "uz" ? "RU" : "UZ"})`,
            onClick: handleChangeLanguage,
        },
        { key: "logout", icon: LogOut, label: t("logout"), onClick: () => logout.mutate() },
    ];

    return (
        <PageTransition className="flex flex-col items-center px-4 py-6">
            <Avatar className="h-32 w-32">
                {profile?.photo && <AvatarImage src={profile.photo} alt={displayName} />}
                <AvatarFallback className="text-3xl">{initials}</AvatarFallback>
            </Avatar>

            <h2 className="mt-3 text-3xl font-bold">{displayName}</h2>
            {username && <p className="text-foreground text-base font-medium">@{username}</p>}
            {user?.telegramId && <p className="text-xs font-light">ID: {user.telegramId}</p>}
            {profile?.createdAt && (
                <p className="text-base font-normal">
                    {t("registered")}: {formatDate(profile.createdAt, localeCode)}
                </p>
            )}

            {/* Debt Balance */}
            {debtSummary && debtSummary.balance > 0 && (
                <motion.div
                    className="mt-4 w-full rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                    <div className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-red-600 dark:text-red-400" />
                        <span className="text-sm font-medium text-red-700 dark:text-red-300">
                            {t("debt_balance")}
                        </span>
                    </div>
                    <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-300">
                        {debtSummary.balance.toLocaleString()}
                    </p>
                    <p className="text-xs text-red-500 dark:text-red-400">
                        {t("debt_total")}: {debtSummary.totalDebt.toLocaleString()}
                        {" · "}
                        {t("debt_paid")}: {debtSummary.totalPaid.toLocaleString()}
                    </p>
                </motion.div>
            )}

            <div className="mt-6 w-full space-y-2.5">
                {menuItems.map(({ key, icon: Icon, label, onClick }) => (
                    <motion.button
                        key={key}
                        type="button"
                        onClick={onClick}
                        className="bg-accent flex w-full items-center gap-2 rounded-lg px-3 py-3"
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                        <Icon className="text-accent-foreground h-5 w-5" />
                        <span className="text-accent-foreground text-base font-medium">
                            {label}
                        </span>
                    </motion.button>
                ))}
            </div>
        </PageTransition>
    );
}

export const Route = createFileRoute("/_user/profile")({
    component: ProfilePage,
});
