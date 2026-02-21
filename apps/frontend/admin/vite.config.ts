import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { resolve } from "node:path";

export default defineConfig({
    base: "/admin/",
    envDir: resolve(process.cwd(), "../../.."),
    plugins: [
        tanstackRouter({
            target: "react",
            autoCodeSplitting: true,
        }),
        react(),
        tailwindcss(),
        tsconfigPaths(),
    ],
    server: {
        port: 5173,
        host: "0.0.0.0",
        allowedHosts: ['msoffta-pc.tail420b9b.ts.net'],
        proxy: {
            "/api": {
                target: "https://localhost:3000",
                changeOrigin: true,
                secure: false,
            },
        },
    },
});
