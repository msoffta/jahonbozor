import { Cron } from "croner";

import { debtReminderMessages } from "@bot/lib/messages";
import { getDebtors } from "@bot/services/debt-reminder.service";

import type { Logger } from "@jahonbozor/logger";
import type { Bot } from "grammy";

const DEBT_REMINDER_CRON = "0 10 * * *";
const DEBT_REMINDER_TIMEZONE = "Asia/Samarkand";

function formatBalance(balance: number): string {
    return balance.toLocaleString("ru-RU");
}

export function startDebtReminderScheduler(bot: Bot, logger: Logger): Cron {
    return new Cron(
        DEBT_REMINDER_CRON,
        { timezone: DEBT_REMINDER_TIMEZONE, protect: true },
        async () => {
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
        },
    );
}
