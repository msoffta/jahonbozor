import * as Sentry from "@sentry/react";
import { StrictMode, lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";

import { routeTree } from "./routeTree.gen";
import { queryClient } from "@/lib/query-client";
import "@/i18n/config";
import "@/index.css";

const router = createRouter({
    routeTree,
    context: {
        queryClient,
    },
});

Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
        Sentry.tanstackRouterBrowserTracingIntegration(router),
        Sentry.replayIntegration({
            maskAllText: false,
            maskAllInputs: true,
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
                                  render: (
                                      <TanStackRouterDevtoolsPanel
                                          router={router}
                                      />
                                  ),
                                  defaultOpen: false,
                              },
                          ]}
                      />
                  ),
              }),
          ),
      );

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
            <Suspense>
                {/* <TanStackDevtools /> */}
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
