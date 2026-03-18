import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

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
            thresholds: {
                lines: 80,
                branches: 75,
                functions: 80,
                statements: 80,
            },
        },
    },
});
