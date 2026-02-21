import type { Logger } from "@jahonbozor/logger";
import { prisma } from "@bot/lib/prisma";

type PhoneResult =
    | { success: true }
    | { success: false; error: "PHONE_TAKEN" | "USER_NOT_FOUND" | "ALREADY_HAS_PHONE" | "DB_ERROR" };

export abstract class PhoneService {
    static async savePhone(telegramId: string, phone: string, logger: Logger): Promise<PhoneResult> {
        try {
            const user = await prisma.users.findUnique({
                where: { telegramId },
                select: { id: true, phone: true },
            });

            if (!user) {
                logger.warn("PhoneService: User not found by telegramId", { telegramId });
                return { success: false, error: "USER_NOT_FOUND" };
            }

            if (user.phone) {
                logger.info("PhoneService: User already has phone", { telegramId, existingPhone: user.phone });
                return { success: false, error: "ALREADY_HAS_PHONE" };
            }

            const existingUserWithPhone = await prisma.users.findUnique({
                where: { phone },
                select: { id: true },
            });

            if (existingUserWithPhone && existingUserWithPhone.id !== user.id) {
                logger.warn("PhoneService: Phone already taken", {
                    phone,
                    telegramId,
                    existingUserId: existingUserWithPhone.id,
                });
                return { success: false, error: "PHONE_TAKEN" };
            }

            await prisma.users.update({
                where: { id: user.id },
                data: { phone },
            });

            logger.info("PhoneService: Phone saved", { userId: user.id, telegramId });
            return { success: true };
        } catch (error) {
            logger.error("PhoneService: Error saving phone", { telegramId, phone, error });
            return { success: false, error: "DB_ERROR" };
        }
    }
}
