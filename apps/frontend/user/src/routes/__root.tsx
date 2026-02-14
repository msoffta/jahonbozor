import type { QueryClient } from "@tanstack/react-query";
import {
    createRootRouteWithContext,
    Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

interface RouterContext {
    queryClient: QueryClient;
    auth: {
        isAuthenticated: boolean;
        user: { id: number; type: string } | null;
    };
}

const RootLayout = () => (
    <>
        <Outlet />
        <TanStackRouterDevtools />
    </>
);

export const Route = createRootRouteWithContext<RouterContext>()({
    component: RootLayout,
});
