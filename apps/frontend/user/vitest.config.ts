import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react(), tailwindcss(), tsconfigPaths()],
    test: {
        environment: "happy-dom",
        setupFiles: ["./test/setup.ts"],
        clearMocks: true,
        coverage: {
            exclude: ["src/routeTree.gen.ts", "src/i18n/**", "src/test-utils/**", "src/locales/**"],
        },
    },
});
