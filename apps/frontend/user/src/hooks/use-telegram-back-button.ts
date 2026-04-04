import { useEffect } from "react";

import { useRouter, useRouterState } from "@tanstack/react-router";
import { backButton } from "@telegram-apps/sdk-react";

import { getIsMiniApp } from "@/lib/telegram";

/**
 * Global Telegram Mini App back button — shows on all pages except home ("/").
 * Navigates back in history on click.
 */
export function useTelegramBackButton() {
    const router = useRouter();
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const isHome = pathname === "/";

    useEffect(() => {
        if (!getIsMiniApp()) return;
        if (!backButton.show.isAvailable()) return;

        if (isHome) {
            backButton.hide();
        } else {
            backButton.show();
        }

        const off = backButton.onClick(() => {
            router.history.back();
        });

        return () => {
            off();
        };
    }, [router, isHome]);
}
