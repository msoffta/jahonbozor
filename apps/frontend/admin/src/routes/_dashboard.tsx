import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { BottomNav } from "@/components/layouts/bottom-nav";
import { Header } from "@/components/layouts/header";
import { useAuthStore } from "@/stores/auth.store";

function DashboardLayout() {
    return (
        <div className="flex h-screen flex-col">
            <Header />
            <main className="flex min-h-0 flex-1 flex-col pb-24 md:pb-8">
                <Outlet />
            </main>
            <BottomNav />
        </div>
    );
}

export const Route = createFileRoute("/_dashboard")({
    beforeLoad: async () => {
        const { isAuthenticated } = useAuthStore.getState();
        if (!isAuthenticated) {
            throw redirect({ to: "/login" });
        }
    },
    component: DashboardLayout,
});
