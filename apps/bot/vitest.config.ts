import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        setupFiles: ["./test/setup.ts"],
        mockReset: true,
        restoreAllMocks: true,
        testTimeout: 5000,
    },
    resolve: {
        alias: {
            "@bot": path.resolve(__dirname, "src"),
            "@backend/generated": path.resolve(__dirname, "../backend/src/generated"),
        },
    },
});
