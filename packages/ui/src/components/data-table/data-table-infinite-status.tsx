import * as React from "react";

import { Check, Copy, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "../ui/button";

import type { DataTableTranslations } from "./types";

/** Duration to show "copied" checkmark after clipboard copy */
const COPIED_FEEDBACK_MS = 2000;

interface DataTableInfiniteStatusProps {
    loadedCount: number;
    totalCount?: number;
    isFetchingNextPage?: boolean;
    hasNextPage?: boolean;
    translations?: DataTableTranslations;
    dragSumInfo?: {
        sum: number;
        count: number;
        excludedSum?: number;
        excludedCount?: number;
    } | null;
}

export function DataTableInfiniteStatus({
    loadedCount,
    totalCount,
    isFetchingNextPage,
    hasNextPage,
    translations,
    dragSumInfo,
}: DataTableInfiniteStatusProps) {
    const [copied, setCopied] = React.useState(false);

    const handleCopySum = async () => {
        if (!dragSumInfo) return;
        try {
            await navigator.clipboard.writeText(dragSumInfo.sum.toString());
            setCopied(true);
            setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
        } catch {
            // Clipboard API unavailable
        }
    };

    const allLoaded = !hasNextPage;
    const isLoading = isFetchingNextPage && hasNextPage;

    // Only show count when there's more data to load
    const showingText =
        !allLoaded && totalCount != null && totalCount !== loadedCount
            ? translations?.showingOf
                ? translations.showingOf
                      .replace("{{loaded}}", String(loadedCount))
                      .replace("{{total}}", String(totalCount))
                : `${loadedCount} / ${totalCount}`
            : null;

    // Hide the entire bar when nothing to show
    if (!showingText && !isLoading && !dragSumInfo) return null;

    return (
        <div className="flex items-center justify-between px-2 py-2">
            <div className="flex flex-1 items-center gap-4">
                {showingText && <div className="text-muted-foreground text-sm">{showingText}</div>}

                <AnimatePresence>
                    {dragSumInfo && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, x: -10 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95, x: -10 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className="flex items-center gap-2"
                        >
                            <div className="bg-muted/30 flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                                <span className="text-muted-foreground">
                                    {translations?.sumLabel ?? "Sum"} ({dragSumInfo.count}):
                                </span>
                                <span className="text-foreground font-semibold">
                                    {dragSumInfo.sum.toLocaleString()}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="hover:bg-muted ml-1 h-6 w-6"
                                    onClick={() => void handleCopySum()}
                                >
                                    {copied ? (
                                        <Check className="text-success h-3.5 w-3.5" />
                                    ) : (
                                        <Copy className="text-muted-foreground h-3.5 w-3.5" />
                                    )}
                                </Button>
                            </div>
                            {dragSumInfo.excludedSum != null && dragSumInfo.excludedSum > 0 && (
                                <div className="border-destructive/30 bg-destructive/5 flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                                    <span className="text-muted-foreground">
                                        {translations?.excludedSumLabel ?? "Debt"} (
                                        {dragSumInfo.excludedCount}):
                                    </span>
                                    <span className="text-destructive font-semibold">
                                        {dragSumInfo.excludedSum.toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                    >
                        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                        <span className="text-muted-foreground text-sm">
                            {translations?.loadingMore ?? "Loading..."}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
