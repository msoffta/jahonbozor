import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { devtools } from "@tanstack/devtools-vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { resolve } from "node:path";

export default defineConfig({
    envDir: resolve(process.cwd(), "../../.."),
    build: {
        sourcemap: "hidden",
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
                target: "https://localhost:3000",
                changeOrigin: true,
                secure: false,
            },
        },
    },
});
