import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "happy-dom",
        setupFiles: ["./test/setup.ts"],
        include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
        mockReset: true,
    },
});
