import "@/lib/i18n";
import "@/index.css";

import { lazy, StrictMode, Suspense } from "react";
import ReactDOM from "react-dom/client";

import * as Sentry from "@sentry/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";

import { queryClient } from "@/lib/query-client";
import { getRawInitData, initTelegramApp } from "@/lib/telegram";
import { useAuthStore } from "@/stores/auth.store";
import { useUIStore } from "@/stores/ui.store";

import { routeTree } from "./routeTree.gen";

const router = createRouter({
    routeTree,
    context: {
        queryClient,
        auth: undefined!,
    },
});

Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
        Sentry.tanstackRouterBrowserTracingIntegration(router),
        Sentry.replayIntegration({
            maskAllText: false,
            maskAllInputs: false,
            blockAllMedia: false,
        }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    enabled: !!import.meta.env.VITE_SENTRY_DSN,
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

const TanStackDevtools = import.meta.env.PROD
    ? () => null
    : lazy(() =>
          Promise.all([
              import("@tanstack/react-devtools"),
              import("@tanstack/react-query-devtools"),
              import("@tanstack/react-router-devtools"),
          ]).then(
              ([
                  { TanStackDevtools },
                  { ReactQueryDevtoolsPanel },
                  { TanStackRouterDevtoolsPanel },
              ]) => ({
                  default: () => (
                      <TanStackDevtools
                          config={{
                              position: "top-right",
                          }}
                          plugins={[
                              {
                                  name: "TanStack Query",
                                  render: <ReactQueryDevtoolsPanel />,
                                  defaultOpen: false,
                              },
                              {
                                  name: "TanStack Router",
                                  render: <TanStackRouterDevtoolsPanel router={router} />,
                                  defaultOpen: false,
                              },
                          ]}
                      />
                  ),
              }),
          ),
      );

interface WebAppAuthResponse {
    success?: boolean;
    data?: {
        token?: string;
        user?: {
            id: number;
            fullname: string;
            telegramId: string | number;
            phone: string | null;
            language: string;
        };
    };
}

async function authenticateWithMiniApp(): Promise<void> {
    const initData = getRawInitData();
    if (!initData) return;

    const language = useUIStore.getState().locale;

    const response = await fetch("/api/public/users/telegram-webapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, language }),
        credentials: "include",
    });

    if (!response.ok) return;

    const data: WebAppAuthResponse = (await response.json()) as WebAppAuthResponse;
    if (!data.success || !data.data?.token || !data.data.user) return;

    const { token, user } = data.data;
    const lang = user.language === "ru" ? "ru" : "uz";

    useAuthStore.getState().login(token, {
        id: user.id,
        name: user.fullname,
        telegramId: String(user.telegramId),
        phone: user.phone ?? null,
        language: lang,
        type: "user",
    });
    useUIStore.getState().setLocale(lang);
    Sentry.setUser({ id: String(user.id), username: user.fullname });
}

async function bootstrap() {
    const isMiniApp = await initTelegramApp();

    if (isMiniApp && !useAuthStore.getState().isAuthenticated) {
        try {
            await authenticateWithMiniApp();
        } catch {
            // Silent fail — user will see login page as fallback
        }
    }

    function App() {
        const auth = useAuthStore();

        return (
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} context={{ auth }} />
                <Suspense>
                    <TanStackDevtools />
                </Suspense>
            </QueryClientProvider>
        );
    }

    const rootElement = document.getElementById("root")!;
    if (!rootElement.innerHTML) {
        const root = ReactDOM.createRoot(rootElement);
        root.render(
            <StrictMode>
                <App />
            </StrictMode>,
        );
    }
}

void bootstrap();
