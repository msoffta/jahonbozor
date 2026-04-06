import { Cron } from "croner";

import { debtReminderMessages } from "@bot/lib/messages";
import { prisma } from "@bot/lib/prisma";
import { getDebtors } from "@bot/services/debt-reminder.service";

import type { Logger } from "@jahonbozor/logger";
import type { Bot } from "grammy";

const DEBT_REMINDER_CRON = "0 10 * * *";
const DEBT_REMINDER_TIMEZONE = "Asia/Samarkand";
const DEBT_REMINDER_HOUR = 10;
const JOB_NAME = "debt-reminder";

function formatBalance(balance: number): string {
    return balance.toLocaleString("ru-RU");
}

async function sendDebtReminders(bot: Bot, logger: Logger): Promise<void> {
    const debtors = await getDebtors(logger);

    let sent = 0;
    let failed = 0;

    for (const debtor of debtors) {
        const message = debtReminderMessages[debtor.language].reminder(
            debtor.fullname,
            formatBalance(debtor.balance),
        );

        try {
            await bot.api.sendMessage(debtor.telegramId, message);
            sent++;
        } catch (error) {
            failed++;
            logger.warn("Bot: Failed to send debt reminder", {
                telegramId: debtor.telegramId,
                userId: debtor.id,
                error,
            });
        }
    }

    logger.info("Bot: Debt reminders sent", {
        total: debtors.length,
        sent,
        failed,
    });

    // Record this run
    await prisma.cronJobRun.create({ data: { jobName: JOB_NAME } });
}

export function startDebtReminderScheduler(bot: Bot, logger: Logger): Cron {
    return new Cron(DEBT_REMINDER_CRON, { timezone: DEBT_REMINDER_TIMEZONE, protect: true }, () =>
        sendDebtReminders(bot, logger),
    );
}

/**
 * Check if today's debt reminder was missed (e.g., after a deploy)
 * and send it now if needed.
 */
export async function catchUpMissedReminder(bot: Bot, logger: Logger): Promise<void> {
    // Get current time in Asia/Samarkand
    const samarkandNow = new Date(
        new Date().toLocaleString("en-US", { timeZone: DEBT_REMINDER_TIMEZONE }),
    );
    const currentHour = samarkandNow.getHours();

    // Only catch up if it's already past the reminder hour
    if (currentHour < DEBT_REMINDER_HOUR) {
        logger.info("Bot: Before reminder time, no catch-up needed");
        return;
    }

    // Check if today's reminder already ran
    const todayStart = new Date(samarkandNow);
    todayStart.setHours(0, 0, 0, 0);

    const todayRun = await prisma.cronJobRun.findFirst({
        where: {
            jobName: JOB_NAME,
            ranAt: { gte: todayStart },
        },
    });

    if (todayRun) {
        logger.info("Bot: Today's debt reminder already sent, skipping catch-up");
        return;
    }

    logger.info("Bot: Missed today's debt reminder, sending now (catch-up after deploy)");
    await sendDebtReminders(bot, logger);
}
