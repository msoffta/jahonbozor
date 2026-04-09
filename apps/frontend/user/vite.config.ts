import { resolve } from "node:path";

import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, type PluginOption } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    envDir: resolve(process.cwd(), "../../.."),
    resolve: {
        dedupe: ["react", "react-dom", "react/jsx-runtime"],
    },
    build: {
        sourcemap: "hidden",
        rollupOptions: {
            output: {
                manualChunks: {
                    "vendor-react": [
                        "react",
                        "react-dom",
                        "react/jsx-runtime",
                        "react-i18next",
                        "i18next",
                    ],
                    "vendor-radix": [
                        "@radix-ui/react-avatar",
                        "@radix-ui/react-checkbox",
                        "@radix-ui/react-dropdown-menu",
                        "@radix-ui/react-popover",
                        "@radix-ui/react-select",
                        "@radix-ui/react-separator",
                        "@radix-ui/react-slot",
                        "@radix-ui/react-tabs",
                        "@radix-ui/react-tooltip",
                    ],
                    "vendor-tanstack-router": ["@tanstack/react-router", "@tanstack/router-core"],
                    "vendor-tanstack": ["@tanstack/react-query", "@tanstack/query-core"],
                    "vendor-motion": ["motion"],
                    "vendor-utils": [
                        "date-fns",
                        "lucide-react",
                        "sonner",
                        "clsx",
                        "tailwind-merge",
                        "class-variance-authority",
                    ],
                    "vendor-sentry": ["@sentry/react", "@sentry/browser", "@sentry/core"],
                },
            },
        },
    },
    plugins: [
        devtools(),
        tanstackRouter({
            target: "react",
            autoCodeSplitting: true,
            routeFileIgnorePattern: "__tests__",
        }),
        react(),
        tailwindcss(),
        tsconfigPaths(),
        sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT_FRONTEND,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            sourcemaps: {
                filesToDeleteAfterUpload: ["./dist/**/*.map"],
            },
            telemetry: false,
        }) as PluginOption,
    ],
    server: {
        allowedHosts: true,
        port: 5174,
        host: "0.0.0.0",
        proxy: {
            "/api": {
                target: "http://localhost:3000",
                changeOrigin: true,
            },
        },
    },
});
