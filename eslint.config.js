import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default defineConfig([
    // ── Global ignores ────────────────────────────────────────────
    globalIgnores([
        "**/dist/**",
        "**/node_modules/**",
        "**/coverage/**",
        "**/*.gen.ts",
        "**/src/generated/**",
        "logs/**",
        "certs/**",
        "nginx/**",
        "scripts/**",
    ]),

    // ── Base: all TypeScript files ────────────────────────────────
    {
        files: ["**/*.{ts,tsx}"],
        extends: [
            js.configs.recommended,
            tseslint.configs.recommendedTypeChecked,
            tseslint.configs.stylisticTypeChecked,
        ],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            "simple-import-sort": simpleImportSort,
        },
        rules: {
            // ── Import sorting ──
            "simple-import-sort/imports": [
                "error",
                {
                    groups: [
                        // Side effects
                        ["^\\u0000"],
                        // Node/Bun builtins
                        ["^node:", "^bun:"],
                        // React
                        ["^react", "^react-dom"],
                        // Third-party
                        ["^@?\\w"],
                        // @jahonbozor workspace packages
                        ["^@jahonbozor/"],
                        // Workspace aliases
                        ["^@backend/", "^@bot/", "^@/"],
                        // Relative
                        ["^\\."],
                        // Type imports
                        ["^.*\\u0000$"],
                    ],
                },
            ],
            "simple-import-sort/exports": "error",

            // ── No any ──
            "@typescript-eslint/no-explicit-any": "error",

            // ── Consistent type imports ──
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    prefer: "type-imports",
                    fixStyle: "separate-type-imports",
                },
            ],

            // ── No unused vars (allow _prefix) ──
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],

            // ── No console ──
            "no-console": "error",

            // ── Floating promises must be handled ──
            "@typescript-eslint/no-floating-promises": "error",

            // ── No default exports ──
            "no-restricted-syntax": [
                "error",
                {
                    selector: "ExportDefaultDeclaration",
                    message: "Use named exports instead of default exports.",
                },
            ],

            // ── Prefer modern patterns ──
            "@typescript-eslint/prefer-nullish-coalescing": "error",
            "@typescript-eslint/prefer-optional-chain": "error",

            // ── Allow async React event handlers ──
            "@typescript-eslint/no-misused-promises": [
                "error",
                { checksVoidReturn: { attributes: false } },
            ],
        },
    },

    // ── React: frontend apps + UI package ─────────────────────────
    {
        files: ["apps/frontend/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}"],
        extends: [
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
            reactX.configs["recommended-typescript"],
            reactDom.configs.recommended,
        ],
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
        },
    },

    // ── Backend + Bot (Bun/Node runtime) ──────────────────────────
    {
        files: ["apps/backend/**/*.ts", "apps/bot/**/*.ts"],
        languageOptions: {
            globals: {
                ...globals.node,
                Bun: "readonly",
            },
        },
    },

    // ── Pure TypeScript packages ──────────────────────────────────
    {
        files: ["packages/schemas/**/*.ts", "packages/logger/**/*.ts", "packages/utils/**/*.ts"],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },

    // ── Allow console in startup/entry files ──────────────────────
    {
        files: ["apps/backend/src/index.ts", "apps/bot/src/index.ts"],
        rules: {
            "no-console": "off",
        },
    },

    // ── Frontend API files: Eden Treaty loses types ────────────
    {
        files: ["apps/frontend/**/api/**/*.ts"],
        rules: {
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/only-throw-error": "off",
            "@typescript-eslint/no-floating-promises": "off",
        },
    },

    // ── Frontend route files: TanStack Router patterns ───────
    {
        files: ["apps/frontend/**/routes/**/*.{ts,tsx}"],
        rules: {
            "@typescript-eslint/only-throw-error": "off",
            "@typescript-eslint/require-await": "off",
        },
    },

    // ── Allow default exports in config files ─────────────────────
    {
        files: ["**/vite.config.ts", "**/vitest.config.ts", "eslint.config.js"],
        rules: {
            "no-restricted-syntax": "off",
        },
    },

    // ── Test files: relax strict rules ────────────────────────────
    {
        files: [
            "**/__tests__/**/*.{ts,tsx}",
            "**/*.test.{ts,tsx}",
            "**/test/**/*.{ts,tsx}",
            "**/test-utils/**/*.{ts,tsx}",
        ],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/ban-ts-comment": "off",
            "@typescript-eslint/require-await": "off",
            "@typescript-eslint/await-thenable": "off",
            "@typescript-eslint/only-throw-error": "off",
            "@typescript-eslint/no-empty-function": "off",
            "@typescript-eslint/no-unsafe-function-type": "off",
            "@typescript-eslint/unbound-method": "off",
            "@typescript-eslint/prefer-nullish-coalescing": "off",
            "no-useless-catch": "off",
            "no-console": "off",
        },
    },

    // ── Prettier must be LAST ─────────────────────────────────────
    eslintConfigPrettier,
]);
