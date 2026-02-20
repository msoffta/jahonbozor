import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { password } from "bun";
import { ALL_PERMISSIONS } from "@jahonbozor/schemas/src/permissions";

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

    console.log(`✅ Role "${rootRole.name}" (id=${rootRole.id}) — ${rootRole.permissions.length} permissions`);

    // 2. Staff: root admin account
    const rootPassword = process.env.ROOT_PASSWORD ?? "root1234";
    const rootHash = await password.hash(rootPassword, { algorithm: "argon2id" });

    // Delete old "root" staff duplicates, then create/update one
    await prisma.staff.deleteMany({ where: { username: "root" } });
    const rootStaff = await prisma.staff.create({
        data: {
            fullname: "Root Admin",
            username: "root",
            passwordHash: rootHash,
            telegramId: BigInt(0),
            roleId: rootRole.id,
        },
    });

    console.log(`✅ Staff "${rootStaff.username}" (id=${rootStaff.id}) — role: ${rootRole.name}`);

    // 3. User: superuser
    const superuser = await prisma.users.upsert({
        where: { phone: "+998900000000" },
        update: {},
        create: {
            fullname: "Superuser",
            username: "superuser",
            phone: "+998900000000",
        },
    });

    console.log(`✅ User "${superuser.username}" (id=${superuser.id})`);
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
