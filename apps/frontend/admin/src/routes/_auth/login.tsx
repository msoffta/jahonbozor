import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button, Input, cn, motion } from "@jahonbozor/ui";
import { useLogin } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth.store";
import { useUIStore } from "@/stores/ui.store";

function LoginPage() {
    const { t } = useTranslation();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const loginMutation = useLogin();
    const locale = useUIStore((s) => s.locale);
    const setLocale = useUIStore((s) => s.setLocale);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        loginMutation.mutate({ username, password });
    };

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 p-6">
            <h1 className="text-center text-2xl font-bold">
                {t("app_name")}
            </h1>

            <div className="flex gap-3">
                <motion.button
                    type="button"
                    onClick={() => setLocale("uz")}
                    className={cn(
                        "flex-1 rounded-2xl py-3 text-sm font-semibold transition-colors",
                        locale === "uz"
                            ? "bg-accent text-accent-foreground"
                            : "bg-muted text-foreground",
                    )}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    {t("uzbek")}
                </motion.button>
                <motion.button
                    type="button"
                    onClick={() => setLocale("ru")}
                    className={cn(
                        "flex-1 rounded-2xl py-3 text-sm font-semibold transition-colors",
                        locale === "ru"
                            ? "bg-accent text-accent-foreground"
                            : "bg-muted text-foreground",
                    )}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    {t("russian")}
                </motion.button>
            </div>

            <Input
                placeholder={t("username")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
            />

            <Input
                type="password"
                placeholder={t("password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
            />

            {loginMutation.isError && (
                <p className="text-sm text-red-500 text-center">{t("login_error")}</p>
            )}

            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? t("loading") : t("login")}
            </Button>
        </form>
    );
}

export const Route = createFileRoute("/_auth/login")({
    beforeLoad: () => {
        const { isAuthenticated } = useAuthStore.getState();
        if (isAuthenticated) {
            throw redirect({ to: "/" });
        }
    },
    component: LoginPage,
});
