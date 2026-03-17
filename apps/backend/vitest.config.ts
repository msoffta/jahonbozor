import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: false, // Explicit imports (не глобальные describe/test)
        environment: "node", // Node.js environment (backend не нуждается в DOM)
        setupFiles: ["./test/setup.ts"], // Загружается перед каждым тестовым файлом
        mockReset: true, // Auto-reset моков между тестами
        restoreMocks: true, // Auto-restore spies
        clearMocks: true, // Auto-clear call history
        include: ["src/**/__tests__/**/*.test.ts"], // Паттерн тестовых файлов
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: ["src/generated/**", "src/**/__tests__/**", "test/**"],
        },
        alias: {
            "@backend/lib": path.resolve(__dirname, "./src/lib"),
            "@backend/api": path.resolve(__dirname, "./src/api"),
            "@backend/generated": path.resolve(__dirname, "./src/generated"),
            "@backend/test": path.resolve(__dirname, "./test"),
        },
    },
});
