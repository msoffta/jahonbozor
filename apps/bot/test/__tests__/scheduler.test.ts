import { beforeEach, describe, expect, test, vi } from "vitest";

import type { DebtorInfo } from "@bot/services/debt-reminder.service";
import type { Logger } from "@jahonbozor/logger";

const { mockCronStop, mockGetDebtors, cronCallbacks } = vi.hoisted(() => ({
    mockCronStop: vi.fn(),
    mockGetDebtors: vi.fn().mockResolvedValue([] as DebtorInfo[]),
    cronCallbacks: [] as (() => Promise<void>)[],
}));

vi.mock("croner", () => ({
    Cron: vi.fn(function (
        this: { stop: typeof mockCronStop },
        _pattern: string,
        _options: unknown,
        callback: () => Promise<void>,
    ) {
        cronCallbacks.push(callback);
        this.stop = mockCronStop;
    }),
}));

vi.mock("@bot/services/debt-reminder.service", () => ({
    getDebtors: (...args: unknown[]) => mockGetDebtors(...(args as [])),
}));

const { Cron } = await import("croner");
const { startDebtReminderScheduler } = await import("@bot/lib/scheduler");

const mockSendMessage = vi.fn().mockResolvedValue({});
const mockBot = { api: { sendMessage: mockSendMessage } } as any;

const mockLogger: Logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
} as unknown as Logger;

describe("startDebtReminderScheduler", () => {
    beforeEach(() => {
        mockCronStop.mockReset();
        mockGetDebtors.mockReset().mockResolvedValue([]);
        mockSendMessage.mockReset().mockResolvedValue({});
        (mockLogger.info as ReturnType<typeof vi.fn>).mockReset();
        (mockLogger.warn as ReturnType<typeof vi.fn>).mockReset();
        (mockLogger.error as ReturnType<typeof vi.fn>).mockReset();
        cronCallbacks.length = 0;
    });

    test("creates cron with correct schedule and timezone", () => {
        startDebtReminderScheduler(mockBot, mockLogger);

        expect(Cron).toHaveBeenCalledWith(
            "0 10 * * *",
            { timezone: "Asia/Samarkand", protect: true },
            expect.any(Function),
        );
    });

    test("returns object with stop method", () => {
        const job = startDebtReminderScheduler(mockBot, mockLogger);

        expect(job).toHaveProperty("stop");
        expect(typeof job.stop).toBe("function");
    });

    test("sends message to each debtor with correct format", async () => {
        const debtors: DebtorInfo[] = [
            { id: 1, fullname: "Ali", telegramId: "111", language: "uz", balance: 50000 },
            { id: 2, fullname: "Ivan", telegramId: "222", language: "ru", balance: 30000 },
        ];
        mockGetDebtors.mockResolvedValueOnce(debtors);

        startDebtReminderScheduler(mockBot, mockLogger);
        await cronCallbacks[0]();

        expect(mockSendMessage).toHaveBeenCalledTimes(2);
        expect(mockSendMessage).toHaveBeenCalledWith("111", expect.any(String));
        expect(mockSendMessage).toHaveBeenCalledWith("222", expect.any(String));
    });

    test("formats UZ message correctly", async () => {
        mockGetDebtors.mockResolvedValueOnce([
            { id: 1, fullname: "Ali Valiyev", telegramId: "111", language: "uz", balance: 50000 },
        ]);

        startDebtReminderScheduler(mockBot, mockLogger);
        await cronCallbacks[0]();

        const sentMessage = mockSendMessage.mock.calls[0][1] as string;
        expect(sentMessage).toContain("Ali Valiyev");
        expect(sentMessage).toContain("50");
        expect(sentMessage).toContain("so'm");
    });

    test("formats RU message correctly", async () => {
        mockGetDebtors.mockResolvedValueOnce([
            { id: 1, fullname: "Иван Петров", telegramId: "222", language: "ru", balance: 75000 },
        ]);

        startDebtReminderScheduler(mockBot, mockLogger);
        await cronCallbacks[0]();

        const sentMessage = mockSendMessage.mock.calls[0][1] as string;
        expect(sentMessage).toContain("Иван Петров");
        expect(sentMessage).toContain("75");
        expect(sentMessage).toContain("сум");
    });

    test("handles sendMessage failure gracefully and continues to next debtor", async () => {
        mockGetDebtors.mockResolvedValueOnce([
            { id: 1, fullname: "Ali", telegramId: "111", language: "uz", balance: 50000 },
            { id: 2, fullname: "Ivan", telegramId: "222", language: "ru", balance: 30000 },
        ]);
        mockSendMessage.mockRejectedValueOnce(new Error("Forbidden: bot was blocked by the user"));
        mockSendMessage.mockResolvedValueOnce({});

        startDebtReminderScheduler(mockBot, mockLogger);
        await cronCallbacks[0]();

        expect(mockSendMessage).toHaveBeenCalledTimes(2);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            "Bot: Failed to send debt reminder",
            expect.objectContaining({ telegramId: "111" }),
        );
    });

    test("logs summary with total/sent/failed counts", async () => {
        mockGetDebtors.mockResolvedValueOnce([
            { id: 1, fullname: "Ali", telegramId: "111", language: "uz", balance: 50000 },
            { id: 2, fullname: "Ivan", telegramId: "222", language: "ru", balance: 30000 },
        ]);
        mockSendMessage.mockRejectedValueOnce(new Error("blocked"));
        mockSendMessage.mockResolvedValueOnce({});

        startDebtReminderScheduler(mockBot, mockLogger);
        await cronCallbacks[0]();

        expect(mockLogger.info).toHaveBeenCalledWith(
            "Bot: Debt reminders sent",
            expect.objectContaining({ total: 2, sent: 1, failed: 1 }),
        );
    });

    test("does not send when no debtors", async () => {
        mockGetDebtors.mockResolvedValueOnce([]);

        startDebtReminderScheduler(mockBot, mockLogger);
        await cronCallbacks[0]();

        expect(mockSendMessage).not.toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(
            "Bot: Debt reminders sent",
            expect.objectContaining({ total: 0, sent: 0, failed: 0 }),
        );
    });

    test("stop calls cron stop", () => {
        const job = startDebtReminderScheduler(mockBot, mockLogger);
        job.stop();

        expect(mockCronStop).toHaveBeenCalled();
    });
});
