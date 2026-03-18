import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
    component: () => (
        <div className="bg-background flex min-h-screen items-center justify-center">
            <Outlet />
        </div>
    ),
});
