import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        tsconfigPaths(),
    ],
    test: {
        environment: "happy-dom",
        setupFiles: ["./test/setup.ts"],
        clearMocks: true,
        coverage: {
            exclude: ["src/routeTree.gen.ts", "src/i18n/**"],
        },
    },
});
