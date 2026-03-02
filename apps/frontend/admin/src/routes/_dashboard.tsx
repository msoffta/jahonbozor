import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Header } from "@/components/layouts/header";
import { BottomNav } from "@/components/layouts/bottom-nav";
import { useAuthStore } from "@/stores/auth.store";

function DashboardLayout() {
    return (
        <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex flex-1 flex-col pb-14">
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
