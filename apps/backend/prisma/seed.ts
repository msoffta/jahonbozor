/* eslint-disable no-console */
import { PrismaPg } from "@prisma/adapter-pg";
import { password } from "bun";

import { ALL_PERMISSIONS } from "@jahonbozor/schemas/src/permissions";

import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
    // 1. Role: root — all permissions
    const rootRole = await prisma.role.upsert({
        where: { name: "root" },
        update: { permissions: [...ALL_PERMISSIONS] },
        create: {
            name: "root",
            permissions: [...ALL_PERMISSIONS],
        },
    });

    console.log(
        `✅ Role "${rootRole.name}" (id=${rootRole.id}) — ${rootRole.permissions.length} permissions`,
    );

    // 2. Staff: root admin account
    const rootPassword = process.env.ROOT_PASSWORD ?? "root1234";
    const rootHash = await password.hash(rootPassword, { algorithm: "argon2id" });

    const rootStaff = await prisma.staff.upsert({
        where: { username: "root" },
        update: { roleId: rootRole.id },
        create: {
            fullname: "Root Admin",
            username: "root",
            passwordHash: rootHash,
            telegramId: BigInt(0),
            roleId: rootRole.id,
        },
    });

    console.log(`✅ Staff "${rootStaff.username}" (id=${rootStaff.id}) — role: ${rootRole.name}`);
}

main()
    .then(() => {
        console.log("\n🌱 Seed completed");
    })
    .catch((err) => {
        console.error("❌ Seed failed:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
