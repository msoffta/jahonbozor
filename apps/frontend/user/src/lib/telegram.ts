import {
    backButton,
    closingBehavior,
    init,
    isTMA,
    miniApp,
    retrieveLaunchParams,
    viewport,
} from "@telegram-apps/sdk-react";

declare global {
    interface Window {
        Telegram?: {
            WebApp?: {
                initData: string;
                initDataUnsafe: Record<string, unknown>;
            };
        };
    }
}

let miniAppMode = false;
let rawInitData: string | undefined;

export async function initTelegramApp(): Promise<boolean> {
    try {
        const isMiniApp = await isTMA("complete", { timeout: 200 });
        if (!isMiniApp) return false;

        init();

        const params = retrieveLaunchParams();
        rawInitData = params.initDataRaw as string | undefined;

        // Fallback: read directly from Telegram WebApp object
        if (!rawInitData && window.Telegram?.WebApp?.initData) {
            rawInitData = window.Telegram.WebApp.initData;
        }

        miniAppMode = true;

        // Mount components
        if (backButton.mount.isAvailable()) backButton.mount();
        if (miniApp.mount.isAvailable()) await miniApp.mount();

        // Expand viewport first
        if (viewport.mount.isAvailable()) {
            await viewport.mount();
            if (viewport.expand.isAvailable()) viewport.expand();
        }

        // Bind safe area CSS vars
        if (viewport.bindCssVars.isAvailable()) viewport.bindCssVars();

        // Fullscreen mode
        if (viewport.requestFullscreen.isAvailable()) {
            void viewport.requestFullscreen().catch(() => {
                /* not supported on all clients */
            });
        }

        // Confirm before closing
        if (closingBehavior.mount.isAvailable()) {
            closingBehavior.mount();
            if (closingBehavior.enableConfirmation.isAvailable()) {
                closingBehavior.enableConfirmation();
            }
        }

        // Signal that app is ready
        if (miniApp.ready.isAvailable()) miniApp.ready();

        return true;
    } catch {
        return false;
    }
}

export function getIsMiniApp(): boolean {
    return miniAppMode;
}

export function getRawInitData(): string | undefined {
    return rawInitData;
}
