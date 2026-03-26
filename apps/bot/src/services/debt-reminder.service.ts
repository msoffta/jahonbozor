import { prisma } from "@bot/lib/prisma";

import type { Logger } from "@jahonbozor/logger";

export interface DebtorInfo {
    id: number;
    fullname: string;
    telegramId: string;
    language: "uz" | "ru";
    balance: number;
}

interface DebtorRow {
    id: number;
    fullname: string;
    telegramId: string;
    language: string;
    balance: number;
}

export async function getDebtors(logger: Logger): Promise<DebtorInfo[]> {
    try {
        const rows = await prisma.$queryRaw<DebtorRow[]>`
            SELECT
                u.id,
                u.fullname,
                u."telegramId",
                u.language,
                (COALESCE(debt.total, 0) - COALESCE(paid.total, 0))::float8 AS balance
            FROM "Users" u
            LEFT JOIN (
                SELECT o."userId", SUM(oi.price * oi.quantity) AS total
                FROM "Order" o
                JOIN "OrderItem" oi ON oi."orderId" = o.id
                WHERE o."paymentType" = 'DEBT' AND o."deletedAt" IS NULL
                GROUP BY o."userId"
            ) debt ON debt."userId" = u.id
            LEFT JOIN (
                SELECT "userId", SUM(amount) AS total
                FROM "DebtPayment"
                GROUP BY "userId"
            ) paid ON paid."userId" = u.id
            WHERE u."telegramId" IS NOT NULL
              AND u."deletedAt" IS NULL
              AND (COALESCE(debt.total, 0) - COALESCE(paid.total, 0)) > 0
        `;

        return rows.map((row) => ({
            ...row,
            language: row.language === "ru" ? ("ru" as const) : ("uz" as const),
        }));
    } catch (error) {
        logger.error("Bot: Failed to get debtors", { error });
        return [];
    }
}
