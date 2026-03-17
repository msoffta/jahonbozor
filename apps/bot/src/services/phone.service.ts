import type { Logger } from "@jahonbozor/logger";
import { prisma } from "@bot/lib/prisma";

type PhoneResult =
    | { success: true }
    | { success: false; error: "PHONE_TAKEN" | "USER_NOT_FOUND" | "ALREADY_HAS_PHONE" | "DB_ERROR" };

export async function savePhone(telegramId: string, phone: string, logger: Logger): Promise<PhoneResult> {
    try {
        return await prisma.$transaction(async (tx) => {
            const user = await tx.users.findFirst({
                where: { telegramId, deletedAt: null },
                select: { id: true, phone: true },
            });

            if (!user) {
                logger.warn("PhoneService: User not found by telegramId", { telegramId });
                return { success: false, error: "USER_NOT_FOUND" } as const;
            }

            if (user.phone) {
                logger.info("PhoneService: User already has phone", { telegramId });
                return { success: false, error: "ALREADY_HAS_PHONE" } as const;
            }

            const existingUserWithPhone = await tx.users.findFirst({
                where: { phone, deletedAt: null },
                select: { id: true },
            });

            if (existingUserWithPhone && existingUserWithPhone.id !== user.id) {
                logger.warn("PhoneService: Phone already taken", {
                    telegramId,
                    existingUserId: existingUserWithPhone.id,
                });
                return { success: false, error: "PHONE_TAKEN" } as const;
            }

            await tx.users.update({
                where: { id: user.id },
                data: { phone },
            });

            await tx.auditLog.create({
                data: {
                    actorId: user.id,
                    actorType: "USER",
                    entityType: "Users",
                    entityId: user.id,
                    action: "UPDATE",
                    previousData: { phone: null },
                    newData: { phone },
                },
            });

            logger.info("PhoneService: Phone saved", { userId: user.id, telegramId });
            return { success: true } as const;
        });
    } catch (error) {
        if (error instanceof Error && error.message.includes("Unique constraint")) {
            logger.warn("PhoneService: Phone taken (constraint)", { telegramId });
            return { success: false, error: "PHONE_TAKEN" };
        }
        logger.error("PhoneService: Error saving phone", { telegramId, error });
        return { success: false, error: "DB_ERROR" };
    }
}
