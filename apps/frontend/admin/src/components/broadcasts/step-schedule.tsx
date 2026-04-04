import { useTranslation } from "react-i18next";

import { format } from "date-fns";

import {
    AnimatePresence,
    Badge,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    cn,
    DatePicker,
    motion,
    Separator,
} from "@jahonbozor/ui";

import type { SendVia } from "./broadcast-types";

interface StepScheduleProps {
    sendNow: boolean;
    setSendNow: (v: boolean) => void;
    scheduledAt: Date | undefined;
    setScheduledAt: (v: Date | undefined) => void;
    name: string;
    recipientCount: number;
    sendVia: SendVia;
    sessionName: string;
    useTemplate: boolean;
    templateName: string | null;
}

export function StepSchedule({
    sendNow,
    setSendNow,
    scheduledAt,
    setScheduledAt,
    name,
    recipientCount,
    sendVia,
    sessionName,
    useTemplate,
    templateName,
}: StepScheduleProps) {
    const { t } = useTranslation("broadcasts");

    return (
        <div className="space-y-6">
            {/* Send mode toggle */}
            <div className="flex gap-2">
                <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSendNow(true)}
                    className={cn(
                        "rounded-lg border px-4 py-2 text-sm transition-colors",
                        sendNow
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50",
                    )}
                >
                    {t("send_now")}
                </motion.button>
                <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSendNow(false)}
                    className={cn(
                        "rounded-lg border px-4 py-2 text-sm transition-colors",
                        !sendNow
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50",
                    )}
                >
                    {t("schedule_send")}
                </motion.button>
            </div>

            {/* Date picker for scheduled sends */}
            <AnimatePresence>
                {!sendNow && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2"
                    >
                        <label className="text-sm font-medium">{t("scheduled_at")}</label>
                        <DatePicker
                            value={scheduledAt?.toISOString()}
                            onChange={(date) => setScheduledAt(date ? new Date(date) : undefined)}
                            showTime
                            className="max-w-xs"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <Separator />

            {/* Summary */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t("summary")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("name")}</span>
                        <span className="font-medium">{name || "---"}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("step_send_method")}</span>
                        <Badge variant="secondary">
                            {sendVia === "BOT" ? t("send_via_bot") : t("send_via_session")}
                        </Badge>
                    </div>
                    {sendVia === "SESSION" && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("step_session")}</span>
                            <span className="font-medium">{sessionName || "---"}</span>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("message_source")}</span>
                        <span className="font-medium">
                            {useTemplate && templateName ? templateName : t("custom_message")}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("recipients")}</span>
                        <Badge variant="secondary">{recipientCount}</Badge>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("send_mode")}</span>
                        <span className="font-medium">
                            {sendNow
                                ? t("send_now")
                                : scheduledAt
                                  ? format(scheduledAt, "dd.MM.yyyy HH:mm")
                                  : "---"}
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
