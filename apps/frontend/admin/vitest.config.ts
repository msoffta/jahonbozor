import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        environment: "happy-dom",
        setupFiles: ["./test/setup.ts"],
        globals: false,
        clearMocks: true,
        include: ["src/**/*.test.{ts,tsx}"],
        exclude: ["node_modules", "dist"],
        coverage: {
            exclude: ["src/routeTree.gen.ts", "src/i18n/**"],
        },
    },
});
