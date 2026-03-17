import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import * as Sentry from "@sentry/react";
import { createRootRouteWithContext, Outlet, useRouterState } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

import { Button, motion, Toaster } from "@jahonbozor/ui";

import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";
import { tryRefreshToken } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

import type { QueryClient } from "@tanstack/react-query";
import type { ErrorComponentProps } from "@tanstack/react-router";

interface RouterContext {
    queryClient: QueryClient;
    auth: {
        isAuthenticated: boolean;
        user: { id: number; type: string } | null;
    };
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
                <h1 className="text-foreground mt-6 text-2xl font-bold">
                    {t("error_something_wrong")}
                </h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    {error instanceof Error ? error.message : t("error_unexpected")}
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

function RootLayout() {
    const pathname = useRouterState({ select: (state) => state.location.pathname });
    const isLogin = pathname === "/login";

    if (isLogin) {
        return (
            <>
                <Outlet />
                <Toaster position="bottom-center" />
            </>
        );
    }

    return (
        <div className="flex min-h-screen flex-col">
            <Header />
            <main className="bg-background flex-1 pb-24">
                <Outlet />
            </main>
            <BottomNav />
            <Toaster position="bottom-center" />
        </div>
    );
}

export const Route = createRootRouteWithContext<RouterContext>()({
    beforeLoad: async () => {
        const { isAuthenticated } = useAuthStore.getState();
        if (!isAuthenticated) {
            try {
                await tryRefreshToken();
            } catch {
                // silent fail — user stays logged out
            }
        }
    },
    component: RootLayout,
    errorComponent: RootErrorComponent,
});
