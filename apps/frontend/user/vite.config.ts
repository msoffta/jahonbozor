import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { devtools } from "@tanstack/devtools-vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const monorepoRoot = resolve(process.cwd(), "../../../certs");

export default defineConfig({
    envDir: resolve(process.cwd(), "../../.."),
    plugins: [
        devtools(),
        tanstackRouter({
            target: "react",
            autoCodeSplitting: true,
        }),
        react(),
        tailwindcss(),
        tsconfigPaths(),
    ],
    server: {
        allowedHosts: ['7858-198-163-193-178.ngrok-free.app'],
        port: 5174,
        host: "0.0.0.0",
        // https: {
        //     key: readFileSync(resolve(monorepoRoot, "192.168.1.108-key.pem")),
        //     cert: readFileSync(resolve(monorepoRoot, "192.168.1.108.pem")),
        // },
        proxy: {
            "/api": {
                target: "https://localhost:3000",
                changeOrigin: true,
                secure: false,
            },
        },
        // hmr: {
        //     host: "192.168.1.108",
        //     protocol: "wss",
        //     port: 5175, // Spin up a dedicated WS server on a new port
        //     clientPort: 5175, // Tell the browser to connect to this new port
        // },
    },
});
