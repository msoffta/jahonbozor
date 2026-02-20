import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const monorepoRoot = resolve(process.cwd(), "../../..");

export default defineConfig({
    envDir: monorepoRoot,
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
        https: {
            key: readFileSync(resolve(monorepoRoot, "192.168.1.108-key.pem")),
            cert: readFileSync(resolve(monorepoRoot, "192.168.1.108.pem")),
        },
        proxy: {
            "/api": {
                target: "https://localhost:3000",
                changeOrigin: true,
                secure: false,
            },
        },
    },
});
