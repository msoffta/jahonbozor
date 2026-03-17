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
    build: {
        sourcemap: "hidden",
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes("node_modules")) return;
                    if (id.includes("react-dom")) return "vendor-react-dom";
                    if (id.includes("/react/")) return "vendor-react";
                    if (id.includes("@tanstack/react-router") || id.includes("@tanstack/router"))
                        return "vendor-tanstack-router";
                    if (id.includes("@tanstack")) return "vendor-tanstack";
                    if (id.includes("@radix-ui")) return "vendor-radix";
                    if (id.includes("motion")) return "vendor-motion";
                    if (id.includes("@sentry")) return "vendor-sentry";
                    if (id.includes("i18next")) return "vendor-i18n";
                },
            },
        },
    },
    plugins: [
        devtools(),
        tanstackRouter({
            target: "react",
            autoCodeSplitting: true,
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
