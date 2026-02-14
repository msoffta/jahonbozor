import { createFileRoute, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

function LoginPage() {
    const { t } = useTranslation();

    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="w-full max-w-sm space-y-6 p-6">
                <h1 className="text-center text-2xl font-bold">
                    {t("app_name")}
                </h1>
                <p className="text-center text-muted-foreground">
                    {t("login")}
                </p>
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
