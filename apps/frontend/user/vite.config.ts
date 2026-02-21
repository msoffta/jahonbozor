import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { devtools } from "@tanstack/devtools-vite";
import { resolve } from "node:path";

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
        allowedHosts: ['msoffta-pc.tail420b9b.ts.net'],
        port: 5174,
        host: "0.0.0.0",
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
