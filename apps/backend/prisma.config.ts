import { defineConfig } from "prisma/config";
import { resolve } from "path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(import.meta.dirname, "../../.env") });

export default defineConfig({
    schema: "prisma",
    migrations: {
        path: "prisma/migrations",
        seed: "bun prisma/seed.ts"
    },
    datasource: {
        url: process.env.DATABASE_URL!,
    },
});
