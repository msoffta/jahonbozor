import { beforeAll, describe, expect, test, vi } from "vitest";

import { prismaMock } from "../setup";

// Mock grammy before importing index
const mockHandleUpdate = vi.fn(() => Promise.resolve(new Response("OK")));
const mockSetWebhook = vi.fn(() => Promise.resolve());
vi.mock("grammy", () => ({
    Bot: class MockBot {
        constructor() {}
        on() {}
        command() {}
        catch() {}
        api = { setWebhook: mockSetWebhook };
    },
    GrammyError: class GrammyError extends Error {},
    HttpError: class HttpError extends Error {},
    webhookCallback: () => () => mockHandleUpdate(),
}));

// Mock scheduler
const mockSchedulerStop = vi.fn();
const mockStartScheduler = vi.fn(() => ({ stop: mockSchedulerStop }));
vi.mock("@bot/lib/scheduler", () => ({
    startDebtReminderScheduler: (...args: unknown[]) => mockStartScheduler(...(args as [])),
}));

// Mock logger
const mockLogger = vi.hoisted(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
}));
vi.mock("@bot/lib/logger", () => ({ logger: mockLogger }));

// Mock Bun.serve — capture the fetch handler so we can call it directly
let serverFetch: (req: Request) => Response | Promise<Response>;
const mockServer = { port: 3099, stop: vi.fn() };
vi.stubGlobal("Bun", {
    serve: vi.fn((opts: { fetch: (req: Request) => Response | Promise<Response> }) => {
        serverFetch = opts.fetch;
        return mockServer;
    }),
});

// Set required env vars
process.env.TELEGRAM_BOT_TOKEN = "test-token";
process.env.TELEGRAM_WEBHOOK_URL = "https://example.com/bot";
process.env.BOT_PORT = "0";

// State captured during module initialization (before mockReset clears call history)
let webhookCalledWith: string | undefined;
let webhookLoggedSuccess = false;
let schedulerStartedOnBoot = false;
let shutdownHandler: (() => void) | undefined;

describe("bot webhook server", () => {
    beforeAll(async () => {
        // Spy on process.on to capture shutdown handler
        const originalProcessOn = process.on.bind(process);
        vi.spyOn(process, "on").mockImplementation(((event: string, handler: Function) => {
            if (event === "SIGTERM") shutdownHandler = handler as () => void;
            return originalProcessOn(event, handler as (...args: unknown[]) => void);
        }) as typeof process.on);

        // Dynamic import to trigger server creation after mocks
        await import("@bot/index");

        // Let microtask queue drain (webhook .then/.catch)
        await new Promise((r) => setTimeout(r, 10));

        // Capture state before mockReset clears it
        if (mockSetWebhook.mock.calls.length > 0) {
            webhookCalledWith = String((mockSetWebhook.mock.calls as unknown[][])[0][0]);
        }
        webhookLoggedSuccess = mockLogger.info.mock.calls.some(
            (call: unknown[]) =>
                typeof call[0] === "string" && call[0].includes("Bot: Webhook registered"),
        );
        schedulerStartedOnBoot = mockStartScheduler.mock.calls.length > 0;
    });

    test("POST /bot routes to webhook handler", async () => {
        const response = await serverFetch(
            new Request("http://localhost/bot", {
                method: "POST",
                body: JSON.stringify({ update_id: 1 }),
                headers: { "Content-Type": "application/json" },
            }),
        );

        expect(response.status).toBe(200);
        expect(mockHandleUpdate).toHaveBeenCalled();
    });

    test("GET /health returns healthy when DB is reachable", async () => {
        prismaMock.$queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);

        const response = await serverFetch(new Request("http://localhost/health"));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toHaveProperty("status", "ok");
        expect(body).toHaveProperty("uptime");
    });

    test("GET /health returns 503 when DB is unreachable", async () => {
        prismaMock.$queryRaw.mockRejectedValueOnce(new Error("Connection refused"));

        const response = await serverFetch(new Request("http://localhost/health"));
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body).toHaveProperty("status", "unhealthy");
        expect(body).toHaveProperty("uptime");
    });

    test("GET /health logs error when DB is unreachable", async () => {
        const dbError = new Error("Connection refused");
        prismaMock.$queryRaw.mockRejectedValueOnce(dbError);
        vi.mocked(mockLogger.error).mockClear();

        await serverFetch(new Request("http://localhost/health"));

        expect(mockLogger.error).toHaveBeenCalledWith(
            "Bot: Health check DB unreachable",
            expect.objectContaining({ error: dbError }),
        );
    });

    test("GET /bot returns 404 (only POST handled)", async () => {
        const response = await serverFetch(new Request("http://localhost/bot"));

        expect(response.status).toBe(404);
    });

    test("POST /health also returns health status (any method accepted)", async () => {
        prismaMock.$queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);

        const response = await serverFetch(
            new Request("http://localhost/health", { method: "POST" }),
        );

        expect(response.status).toBe(200);
    });

    test("GET /unknown returns 404", async () => {
        const response = await serverFetch(new Request("http://localhost/unknown"));

        expect(response.status).toBe(404);
    });

    test("POST /unknown returns 404", async () => {
        const response = await serverFetch(
            new Request("http://localhost/unknown", { method: "POST" }),
        );

        expect(response.status).toBe(404);
    });
});

describe("webhook registration", () => {
    test("calls bot.api.setWebhook with configured URL", () => {
        expect(webhookCalledWith).toBe("https://example.com/bot");
    });

    test("logs success after webhook registration", () => {
        expect(webhookLoggedSuccess).toBe(true);
    });
});

describe("debt reminder scheduler", () => {
    test("scheduler is started on boot", () => {
        expect(schedulerStartedOnBoot).toBe(true);
    });
});

describe("graceful shutdown", () => {
    test("SIGTERM handler is registered", () => {
        expect(shutdownHandler).toBeDefined();
    });

    test("shutdown stops scheduler, server, disconnects prisma, and exits", async () => {
        // Re-spy process.exit (restoreAllMocks clears previous spy)
        const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

        shutdownHandler!();

        // Allow async shutdown to complete
        await new Promise((r) => setTimeout(r, 50));

        expect(mockSchedulerStop).toHaveBeenCalled();
        expect(mockServer.stop).toHaveBeenCalled();
        expect(prismaMock.$disconnect).toHaveBeenCalled();
        expect(exitSpy).toHaveBeenCalledWith(0);

        exitSpy.mockRestore();
    });
});
