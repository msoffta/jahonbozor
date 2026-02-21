import type { QueryClient } from "@tanstack/react-query";
import {
    createRootRouteWithContext,
    Outlet,
    useRouterState,
} from "@tanstack/react-router";

import { Header } from "@/components/layout/header";
import { PhoneBanner } from "@/components/layout/phone-banner";
import { BottomNav } from "@/components/layout/bottom-nav";
import { tryRefreshToken } from "@/lib/api-client";

interface RouterContext {
    queryClient: QueryClient;
    auth: {
        isAuthenticated: boolean;
        user: { id: number; type: string } | null;
    };
}

function RootLayout() {
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const isLogin = pathname === "/login";

    if (isLogin) {
        return <Outlet />;
    }

    return (
        <div className="flex min-h-screen flex-col">
            <Header />
            <PhoneBanner />
            <main className="flex-1 pb-24 bg-background">
                <Outlet />
            </main>
            <BottomNav />
        </div>
    );
}

let authChecked = false;

export const Route = createRootRouteWithContext<RouterContext>()({
    beforeLoad: async ({ context }) => {
        if (!authChecked) {
            authChecked = true;
            if (!context.auth.isAuthenticated) {
                await tryRefreshToken();
            }
        }
    },
    component: RootLayout,
});
