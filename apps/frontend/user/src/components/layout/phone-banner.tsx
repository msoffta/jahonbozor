import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth.store";
import { Phone, X, ExternalLink } from "lucide-react";
import { AnimatePresence, motion } from "@jahonbozor/ui";

const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? "";

export function PhoneBanner() {
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const [dismissed, setDismissed] = useState(false);

    if (!isAuthenticated || !user || user.phone || dismissed) {
        return null;
    }

    const botLink = TELEGRAM_BOT_USERNAME
        ? `https://t.me/${TELEGRAM_BOT_USERNAME.replace("@", "")}`
        : null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-primary/10 border-b border-primary/20 px-4 py-2.5"
            >
                <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0 text-sm">
                        <p>{t("phone_request_banner")}</p>
                        {botLink && (
                            <a
                                href={botLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-1 font-medium text-primary"
                            >
                                {t("phone_request_banner_link")}
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setDismissed(true)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
