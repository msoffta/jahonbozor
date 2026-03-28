import { useTranslation } from "react-i18next";

import { WifiOff } from "lucide-react";

import { AnimatePresence, motion } from "@jahonbozor/ui";

import { useNetworkStatus } from "@/hooks/use-network-status";

export function OfflineBanner() {
    const isOnline = useNetworkStatus();
    const { t } = useTranslation();

    return (
        <AnimatePresence>
            {!isOnline && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="bg-destructive text-destructive-foreground z-50 overflow-hidden"
                >
                    <div className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium">
                        <WifiOff className="h-3.5 w-3.5" />
                        {t("offline_banner")}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
