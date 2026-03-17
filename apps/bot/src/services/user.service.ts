import { prisma } from "@bot/lib/prisma";

import type { Logger } from "@jahonbozor/logger";
import type { Language } from "@jahonbozor/schemas";

export async function getUserInfo(
    telegramId: string,
    logger: Logger,
): Promise<{ language: Language; phone: string | null }> {
    try {
        const user = await prisma.users.findFirst({
            where: { telegramId, deletedAt: null },
            select: { language: true, phone: true },
        });
        return {
            language: user?.language === "ru" ? "ru" : "uz",
            phone: user?.phone ?? null,
        };
    } catch (error) {
        logger.error("Bot: Failed to get user info", { telegramId, error });
        return { language: "uz", phone: null };
    }
}
