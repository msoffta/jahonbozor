import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import * as Sentry from "@sentry/react";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

import { Button, motion, Toaster } from "@jahonbozor/ui";

import { tryRefreshToken } from "@/api/client";
import { useAuthStore } from "@/stores/auth.store";

import type { QueryClient } from "@tanstack/react-query";
import type { ErrorComponentProps } from "@tanstack/react-router";

interface RouterContext {
    queryClient: QueryClient;
}

function RootErrorComponent({ error, reset }: ErrorComponentProps) {
    const { t } = useTranslation();

    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <div className="bg-background flex min-h-screen items-center justify-center px-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
                className="flex max-w-sm flex-col items-center text-center"
            >
                <div className="bg-destructive/10 flex h-20 w-20 items-center justify-center rounded-full">
                    <AlertTriangle className="text-destructive h-10 w-10" />
                </div>
                <h1 className="text-foreground mt-6 text-2xl font-bold">{t("error_title")}</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    {error instanceof Error ? error.message : t("error_generic")}
                </p>
                <div className="mt-8 flex gap-3">
                    <Button variant="outline" onClick={() => (window.location.href = "/")}>
                        {t("go_home")}
                    </Button>
                    <Button onClick={reset}>{t("try_again")}</Button>
                </div>
            </motion.div>
        </div>
    );
}

const RootLayout = () => (
    <>
        <Outlet />
        <Toaster position="top-right" />
    </>
);

export const Route = createRootRouteWithContext<RouterContext>()({
    beforeLoad: async () => {
        const { isAuthenticated } = useAuthStore.getState();
        if (!isAuthenticated) {
            try {
                await tryRefreshToken();
            } catch {
                // Silent failure on boot is fine
            }
        }
    },
    component: RootLayout,
    errorComponent: RootErrorComponent,
});
