import { prisma } from "@bot/lib/prisma";
import logger from "@bot/lib/logger";

export async function getUserInfo(telegramId: string): Promise<{ language: "uz" | "ru"; phone: string | null }> {
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
