import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { format } from "date-fns";
import { Plus, Radio } from "lucide-react";

import { hasPermission, Permission } from "@jahonbozor/schemas";
import {
    AnimatePresence,
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    cn,
    motion,
    PageTransition,
    Skeleton,
} from "@jahonbozor/ui";

import { broadcastsListQueryOptions } from "@/api/broadcasts.api";
import { useHasPermission } from "@/hooks/use-permissions";
import { useAuthStore } from "@/stores/auth.store";

const SKELETON_COUNT = 6;

interface BroadcastListItem {
    id: number;
    name: string;
    status: string;
    scheduledAt?: string | null;
    sentCount?: number;
    failedCount?: number;
    pendingCount?: number;
    totalRecipients?: number;
    createdAt: string;
}

const STATUS_BADGE_MAP: Record<
    string,
    { variant: "default" | "secondary" | "destructive" | "outline"; className: string }
> = {
    DRAFT: {
        variant: "secondary",
        className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    },
    SCHEDULED: {
        variant: "secondary",
        className: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    },
    SENDING: {
        variant: "secondary",
        className:
            "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 animate-pulse",
    },
    PAUSED: {
        variant: "secondary",
        className: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
    COMPLETED: {
        variant: "secondary",
        className: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    FAILED: { variant: "destructive", className: "" },
};

function getStatusBadge(status: string) {
    return STATUS_BADGE_MAP[status] ?? { variant: "secondary" as const, className: "" };
}

function BroadcastCardSkeleton() {
    return (
        <Card>
            <CardHeader className="pb-2">
                <Skeleton className="h-5 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-3">
                <Skeleton className="h-5 w-20 rounded-full" />
                <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                </div>
            </CardContent>
        </Card>
    );
}

function BroadcastsPage() {
    const { t } = useTranslation("broadcasts");
    const canCreate = useHasPermission(Permission.BROADCASTS_CREATE);

    const { data, isLoading } = useQuery(broadcastsListQueryOptions());

    const broadcasts = useMemo(
        () => (data?.broadcasts ?? []) as unknown as BroadcastListItem[],
        [data],
    );

    return (
        <PageTransition className="flex min-h-0 flex-1 flex-col p-2 md:p-4">
            <div className="mb-4 flex items-center justify-between md:mb-6">
                <h1 className="text-xl font-bold md:text-2xl">{t("title")}</h1>
                {canCreate && (
                    <Link to="/broadcasts/new">
                        <motion.div whileTap={{ scale: 0.95 }}>
                            <Button size="sm">
                                <Plus className="mr-1.5 h-4 w-4" />
                                {t("create")}
                            </Button>
                        </motion.div>
                    </Link>
                )}
            </div>

            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div
                        key="skeleton"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    >
                        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                            <BroadcastCardSkeleton key={i} />
                        ))}
                    </motion.div>
                ) : broadcasts.length === 0 ? (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-1 flex-col items-center justify-center gap-4 py-20"
                    >
                        <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-full">
                            <Radio className="text-muted-foreground h-8 w-8" />
                        </div>
                        <p className="text-muted-foreground text-sm">{t("empty")}</p>
                        {canCreate && (
                            <Link to="/broadcasts/new">
                                <Button variant="outline" size="sm">
                                    <Plus className="mr-1.5 h-4 w-4" />
                                    {t("create")}
                                </Button>
                            </Link>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="grid"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    >
                        {broadcasts.map((broadcast, index) => {
                            const badge = getStatusBadge(broadcast.status);

                            return (
                                <motion.div
                                    key={broadcast.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <Link
                                        to="/broadcasts/$broadcastId"
                                        params={{ broadcastId: String(broadcast.id) }}
                                    >
                                        <Card className="cursor-pointer transition-shadow hover:shadow-md">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="flex items-center justify-between gap-2 text-base">
                                                    <span className="truncate">
                                                        {broadcast.name}
                                                    </span>
                                                    <Badge
                                                        variant={badge.variant}
                                                        className={cn(
                                                            "shrink-0 text-xs",
                                                            badge.className,
                                                        )}
                                                    >
                                                        {t(
                                                            `status_${broadcast.status.toLowerCase()}`,
                                                        )}
                                                    </Badge>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex items-center justify-between">
                                                    {broadcast.totalRecipients != null && (
                                                        <div className="text-muted-foreground flex items-center gap-2 text-xs tabular-nums">
                                                            <span className="text-emerald-600">
                                                                {broadcast.sentCount ?? 0}
                                                            </span>
                                                            <span>/</span>
                                                            <span className="text-red-500">
                                                                {broadcast.failedCount ?? 0}
                                                            </span>
                                                            <span>/</span>
                                                            <span>
                                                                {broadcast.pendingCount ?? 0}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <span className="text-muted-foreground ml-auto text-xs">
                                                        {broadcast.scheduledAt
                                                            ? format(
                                                                  new Date(broadcast.scheduledAt),
                                                                  "dd.MM.yyyy HH:mm",
                                                              )
                                                            : format(
                                                                  new Date(broadcast.createdAt),
                                                                  "dd.MM.yyyy",
                                                              )}
                                                    </span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/broadcasts/")({
    beforeLoad: async () => {
        const { permissions } = useAuthStore.getState();
        if (!hasPermission(permissions, Permission.BROADCASTS_LIST)) {
            throw redirect({ to: "/" });
        }
    },
    component: BroadcastsPage,
});
