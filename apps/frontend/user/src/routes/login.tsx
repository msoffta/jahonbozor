import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";
import { useTelegramLogin } from "@/api/auth.api";

const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? "";

interface TelegramLoginData {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
}

function LoginPage() {
    const { t } = useTranslation();
    const telegramRef = useRef<HTMLDivElement>(null);
    const telegramLogin = useTelegramLogin();
    const navigate = useNavigate();

    useEffect(() => {
        if (!TELEGRAM_BOT_USERNAME || !telegramRef.current) return;

        // Define global callback for Telegram widget
        (window as unknown as Record<string, unknown>).onTelegramAuth = (user: TelegramLoginData) => {
            telegramLogin.mutate(
                {
                    id: user.id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    username: user.username,
                    photo_url: user.photo_url,
                    auth_date: user.auth_date,
                    hash: user.hash,
                },
                {
                    onSuccess: () => {
                        navigate({ to: "/" });
                    },
                },
            );
        };

        // Load Telegram Login Widget script
        const script = document.createElement("script");
        script.src = "https://telegram.org/js/telegram-widget.js?22";
        script.setAttribute("data-telegram-login", TELEGRAM_BOT_USERNAME);
        script.setAttribute("data-size", "large");
        script.setAttribute("data-radius", "8");
        script.setAttribute("data-onauth", "onTelegramAuth(user)");
        script.setAttribute("data-request-access", "write");
        script.async = true;

        telegramRef.current.appendChild(script);

        return () => {
            delete (window as unknown as Record<string, unknown>).onTelegramAuth;
        };
    }, [telegramLogin, navigate]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background">
            <div className="w-full max-w-sm space-y-8 p-6 text-center">
                <div>
                    <h1 className="text-3xl font-bold text-primary">
                        {t("app_name")}
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        {t("login_telegram")}
                    </p>
                </div>

                <div ref={telegramRef} className="flex justify-center" />

                {telegramLogin.isPending && (
                    <p className="text-sm text-muted-foreground">{t("loading")}</p>
                )}

                {telegramLogin.isError && (
                    <p className="text-sm text-destructive">{t("error")}</p>
                )}

                {!TELEGRAM_BOT_USERNAME && (
                    <p className="text-xs text-muted-foreground">
                        VITE_TELEGRAM_BOT_USERNAME not configured
                    </p>
                )}
            </div>
        </div>
    );
}

export const Route = createFileRoute("/login")({
    beforeLoad: ({ context }) => {
        if (context.auth.isAuthenticated) {
            throw redirect({ to: "/" });
        }
    },
    component: LoginPage,
});
