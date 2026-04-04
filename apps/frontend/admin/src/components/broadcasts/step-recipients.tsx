import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import {
    Badge,
    Button,
    Checkbox,
    cn,
    Input,
    motion,
    ScrollArea,
    Skeleton,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@jahonbozor/ui";

import { clientsInfiniteQueryOptions } from "@/api/clients.api";

import type { SendVia } from "./broadcast-types";

const SEARCH_DEBOUNCE_MS = 300;

interface StepRecipientsProps {
    sendVia: SendVia;
    selectedIds: Set<number>;
    setSelectedIds: React.Dispatch<React.SetStateAction<Set<number>>>;
}

export function StepRecipients({ sendVia, selectedIds, setSelectedIds }: StepRecipientsProps) {
    const { t } = useTranslation("broadcasts");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Debounced search
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearchChange = useCallback((value: string) => {
        setSearchQuery(value);
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            setDebouncedSearch(value);
        }, SEARCH_DEBOUNCE_MS);
    }, []);

    const {
        data: clientsData,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery(clientsInfiniteQueryOptions({ searchQuery: debouncedSearch }));

    const allUsers = useMemo(
        () => clientsData?.pages.flatMap((page) => page.users) ?? [],
        [clientsData],
    );

    const totalCount = clientsData?.pages[0]?.count ?? 0;

    const handleToggle = (userId: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) {
                next.delete(userId);
            } else {
                next.add(userId);
            }
            return next;
        });
    };

    // When BOT: only users with telegramId are selectable
    // When SESSION: all users are selectable
    const selectableUsers = useMemo(
        () => (sendVia === "BOT" ? allUsers.filter((u) => u.telegramId) : allUsers),
        [allUsers, sendVia],
    );

    const handleSelectAll = () => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            for (const user of selectableUsers) {
                next.add(user.id);
            }
            return next;
        });
    };

    const handleDeselectAll = () => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            for (const user of selectableUsers) {
                next.delete(user.id);
            }
            return next;
        });
    };

    return (
        <div className="space-y-4">
            {/* Search + actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative sm:max-w-xs">
                    <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    <Input
                        placeholder={t("select_recipients")}
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="shrink-0">
                        {t("selected_count", { count: selectedIds.size })}
                    </Badge>
                    <motion.button
                        type="button"
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSelectAll}
                        className="text-primary text-xs hover:underline"
                    >
                        {t("select_all")}
                    </motion.button>
                    <span className="text-muted-foreground text-xs">/</span>
                    <motion.button
                        type="button"
                        whileTap={{ scale: 0.95 }}
                        onClick={handleDeselectAll}
                        className="text-primary text-xs hover:underline"
                    >
                        {t("deselect_all")}
                    </motion.button>
                </div>
            </div>

            {/* User list */}
            <ScrollArea className="max-h-96 overflow-y-auto rounded-lg border">
                {isLoading ? (
                    <div className="space-y-2 p-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 rounded-md" />
                        ))}
                    </div>
                ) : allUsers.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <p className="text-muted-foreground text-sm">{t("no_recipients_found")}</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {allUsers.map((user) => {
                            const hasTelegram = Boolean(user.telegramId);
                            const isSelectable = sendVia === "SESSION" || hasTelegram;
                            const isChecked = selectedIds.has(user.id);

                            return (
                                <TooltipProvider key={user.id}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <motion.div
                                                whileTap={
                                                    isSelectable ? { scale: 0.99 } : undefined
                                                }
                                                onClick={() =>
                                                    isSelectable && handleToggle(user.id)
                                                }
                                                className={cn(
                                                    "flex items-center gap-3 px-3 py-2.5 transition-colors",
                                                    isSelectable
                                                        ? "hover:bg-muted/50 cursor-pointer"
                                                        : "cursor-not-allowed opacity-50",
                                                    isChecked && "bg-primary/5",
                                                )}
                                            >
                                                <Checkbox
                                                    checked={isChecked}
                                                    disabled={!isSelectable}
                                                    onCheckedChange={() => handleToggle(user.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium">
                                                        {user.fullname}
                                                    </p>
                                                    {user.phone && (
                                                        <p className="text-muted-foreground truncate text-xs">
                                                            {user.phone}
                                                        </p>
                                                    )}
                                                </div>
                                                {!hasTelegram && sendVia === "BOT" && (
                                                    <Badge
                                                        variant="outline"
                                                        className="shrink-0 text-xs"
                                                    >
                                                        {t("bot_cannot_send")}
                                                    </Badge>
                                                )}
                                            </motion.div>
                                        </TooltipTrigger>
                                        {!hasTelegram && sendVia === "BOT" && (
                                            <TooltipContent>{t("bot_cannot_send")}</TooltipContent>
                                        )}
                                    </Tooltip>
                                </TooltipProvider>
                            );
                        })}

                        {/* Load more */}
                        {hasNextPage && (
                            <div className="p-3 text-center">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => fetchNextPage()}
                                    disabled={isFetchingNextPage}
                                >
                                    {isFetchingNextPage
                                        ? t("loading")
                                        : t("load_more", {
                                              loaded: allUsers.length,
                                              total: totalCount,
                                          })}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
