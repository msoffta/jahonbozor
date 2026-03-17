import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import {
    createRootRouteWithContext,
    Outlet,
    useRouterState,
} from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import * as Sentry from "@sentry/react";
import { AlertTriangle } from "lucide-react";
import { Button, motion, Toaster } from "@jahonbozor/ui";

import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";

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
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
                className="flex max-w-sm flex-col items-center text-center"
            >
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                    <AlertTriangle className="h-10 w-10 text-destructive" />
                </div>
                <h1 className="mt-6 text-2xl font-bold text-foreground">
                    {t("error_something_wrong")}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    {error instanceof Error
                        ? error.message
                        : t("error_unexpected")}
                </p>
                <div className="mt-8 flex gap-3">
                    <Button variant="outline" onClick={() => window.location.href = "/"}>
                        {t("go_home")}
                    </Button>
                    <Button onClick={reset}>
                        {t("try_again")}
                    </Button>
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
            <main className="flex-1 pb-24 bg-background">
                <Outlet />
            </main>
            <BottomNav />
            <Toaster position="bottom-center" />
        </div>
    );
}

export const Route = createRootRouteWithContext<RouterContext>()({
    component: RootLayout,
    errorComponent: RootErrorComponent,
});
