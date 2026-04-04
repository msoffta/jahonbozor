import { useTranslation } from "react-i18next";

import { cn, motion } from "@jahonbozor/ui";

const PROGRESS_BAR_HEIGHT_PX = 8;
const SENDING_PULSE_DURATION_S = 1.5;

interface BroadcastProgressProps {
    total: number;
    sent: number;
    failed: number;
    pending: number;
    status: string;
}

export function BroadcastProgress({
    total,
    sent,
    failed,
    pending,
    status,
}: BroadcastProgressProps) {
    const { t } = useTranslation("broadcasts");

    const sentPercent = total > 0 ? (sent / total) * 100 : 0;
    const failedPercent = total > 0 ? (failed / total) * 100 : 0;
    const completedPercent = sentPercent + failedPercent;

    const isSending = status === "SENDING";

    return (
        <div className="space-y-3">
            {/* Progress bar */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("progress")}</span>
                    <span className="font-medium tabular-nums">
                        {Math.round(completedPercent)}%
                    </span>
                </div>

                <div
                    className="bg-muted relative w-full overflow-hidden rounded-full"
                    style={{ height: PROGRESS_BAR_HEIGHT_PX }}
                >
                    {/* Sent portion (green) */}
                    <motion.div
                        className={cn(
                            "absolute inset-y-0 left-0 rounded-full bg-emerald-500",
                            isSending && "animate-pulse",
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${sentPercent}%` }}
                        transition={{
                            type: "spring",
                            stiffness: 100,
                            damping: 20,
                            duration: SENDING_PULSE_DURATION_S,
                        }}
                    />
                    {/* Failed portion (red) */}
                    {failedPercent > 0 && (
                        <motion.div
                            className="absolute inset-y-0 rounded-full bg-red-500"
                            initial={{ width: 0 }}
                            animate={{
                                left: `${sentPercent}%`,
                                width: `${failedPercent}%`,
                            }}
                            transition={{
                                type: "spring",
                                stiffness: 100,
                                damping: 20,
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatCard label={t("stat_total")} value={total} className="bg-muted/50" />
                <StatCard
                    label={t("sent")}
                    value={sent}
                    className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                />
                <StatCard
                    label={t("failed")}
                    value={failed}
                    className="bg-red-500/10 text-red-600 dark:text-red-400"
                />
                <StatCard
                    label={t("pending")}
                    value={pending}
                    className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                />
            </div>
        </div>
    );
}

function StatCard({
    label,
    value,
    className,
}: {
    label: string;
    value: number;
    className?: string;
}) {
    return (
        <div className={cn("rounded-lg px-3 py-2 text-center", className)}>
            <div className="text-xl font-bold tabular-nums">{value}</div>
            <div className="text-muted-foreground text-xs">{label}</div>
        </div>
    );
}
