import dotenv from "dotenv";
import { resolve } from "path";
import { defineConfig } from "prisma/config";

dotenv.config({ path: resolve(import.meta.dirname, "../../.env") });

// eslint-disable-next-line no-restricted-syntax
export default defineConfig({
    schema: "prisma",
    migrations: {
        path: "prisma/migrations",
        seed: "bun prisma/seed.ts",
    },
    datasource: {
        url: process.env.DATABASE_URL!,
    },
});
