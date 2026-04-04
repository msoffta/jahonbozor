import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Mock Telegram Mini App SDK — not available in test environment
vi.mock("@telegram-apps/sdk-react", () => ({
    init: vi.fn(),
    isTMA: vi.fn(() => Promise.resolve(false)),
    retrieveLaunchParams: vi.fn(() => ({ initDataRaw: undefined })),
    backButton: {
        mount: { isAvailable: () => false },
        show: { isAvailable: () => false },
        hide: { isAvailable: () => false },
        onClick: vi.fn(() => vi.fn()),
    },
    miniApp: {
        mount: { isAvailable: () => false },
        ready: { isAvailable: () => false },
    },
    viewport: {
        mount: { isAvailable: () => false },
        expand: { isAvailable: () => false },
        requestFullscreen: { isAvailable: () => false },
    },
    closingBehavior: {
        mount: { isAvailable: () => false },
        enableConfirmation: { isAvailable: () => false },
    },
}));

// Mock telegram lib helper
vi.mock("@/lib/telegram", () => ({
    initTelegramApp: vi.fn(() => Promise.resolve(false)),
    getIsMiniApp: vi.fn(() => false),
    getRawInitData: vi.fn(() => undefined),
}));

// Mock Telegram back button hook — no-op in tests (used globally in __root)
vi.mock("@/hooks/use-telegram-back-button", () => ({
    useTelegramBackButton: vi.fn(),
}));

afterEach(() => {
    cleanup();
});
