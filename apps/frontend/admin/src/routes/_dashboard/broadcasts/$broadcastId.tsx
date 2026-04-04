import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowLeft, Clock, Pause, Play, RefreshCw, Send, Trash2 } from "lucide-react";

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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    toast,
} from "@jahonbozor/ui";

import {
    broadcastDetailQueryOptions,
    broadcastKeys,
    broadcastRecipientsQueryOptions,
    useDeleteBroadcast,
    usePauseBroadcast,
    useResumeBroadcast,
    useRetryBroadcast,
    useSendBroadcast,
} from "@/api/broadcasts.api";
import { BroadcastProgress } from "@/components/broadcasts/broadcast-progress";
import { ConfirmDrawer } from "@/components/shared/confirm-drawer";
import { useHasPermission } from "@/hooks/use-permissions";
import { useAuthStore } from "@/stores/auth.store";

const RECIPIENT_STATUS_ALL = "ALL";
const RECIPIENT_STATUS_SENT = "SENT";
const RECIPIENT_STATUS_FAILED = "FAILED";
const RECIPIENT_STATUS_PENDING = "PENDING";

type RecipientFilter =
    | typeof RECIPIENT_STATUS_ALL
    | typeof RECIPIENT_STATUS_SENT
    | typeof RECIPIENT_STATUS_FAILED
    | typeof RECIPIENT_STATUS_PENDING;

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

const RECIPIENT_BADGE_MAP: Record<
    string,
    { variant: "default" | "secondary" | "destructive" | "outline"; className: string }
> = {
    SENT: {
        variant: "secondary",
        className: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    FAILED: { variant: "destructive", className: "" },
    PENDING: {
        variant: "secondary",
        className: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
};

interface BroadcastDetail {
    id: number;
    name: string;
    status: string;
    content?: string;
    media?: string | null;
    buttons?: string | null;
    templateId?: number | null;
    sessionId?: number;
    stats?: {
        total: number;
        sent: number;
        failed: number;
        pending: number;
    };
    scheduledAt?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

interface RecipientItem {
    id: number;
    userId: number;
    status: string;
    sentAt?: string | null;
    errorMessage?: string | null;
    user?: {
        id: number;
        fullname: string;
        phone?: string | null;
    };
}

function BroadcastDetailPage() {
    const { broadcastId } = Route.useParams();
    const { t } = useTranslation("broadcasts");
    const numericId = Number(broadcastId);

    const canSend = useHasPermission(Permission.BROADCASTS_SEND);
    const canUpdate = useHasPermission(Permission.BROADCASTS_UPDATE);
    const canDelete = useHasPermission(Permission.BROADCASTS_DELETE);

    const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>(RECIPIENT_STATUS_ALL);
    const [deleteOpen, setDeleteOpen] = useState(false);

    // Queries
    const { data: broadcastData, isLoading } = useQuery(broadcastDetailQueryOptions(numericId));

    const broadcast = broadcastData as unknown as BroadcastDetail | undefined;

    const isActive = broadcast?.status === "SENDING" || broadcast?.status === "PAUSED";
    const queryClient = useQueryClient();
    const prevStatusRef = useRef(broadcast?.status);

    // Refetch recipients when broadcast status changes (e.g. SENDING → COMPLETED)
    useEffect(() => {
        if (broadcast?.status && broadcast.status !== prevStatusRef.current) {
            prevStatusRef.current = broadcast.status;
            void queryClient.invalidateQueries({ queryKey: broadcastKeys.recipients(numericId) });
        }
    }, [broadcast?.status, numericId, queryClient]);

    const { data: recipientsData, isLoading: recipientsLoading } = useQuery({
        ...broadcastRecipientsQueryOptions(numericId),
        refetchInterval: isActive ? 3000 : false,
    });

    const allRecipients = useMemo(
        () => (recipientsData?.recipients ?? []) as unknown as RecipientItem[],
        [recipientsData],
    );

    const filteredRecipients = useMemo(() => {
        if (recipientFilter === RECIPIENT_STATUS_ALL) return allRecipients;
        return allRecipients.filter((r) => r.status === recipientFilter);
    }, [allRecipients, recipientFilter]);

    // Mutations
    const sendMutation = useSendBroadcast();
    const pauseMutation = usePauseBroadcast();
    const resumeMutation = useResumeBroadcast();
    const retryMutation = useRetryBroadcast();
    const deleteMutation = useDeleteBroadcast();

    const handleSend = async () => {
        try {
            await sendMutation.mutateAsync(numericId);
            toast.success(t("sent_toast"));
        } catch {
            // handled by hook
        }
    };

    const handlePause = async () => {
        try {
            await pauseMutation.mutateAsync(numericId);
            toast.success(t("paused_toast"));
        } catch {
            // handled by hook
        }
    };

    const handleResume = async () => {
        try {
            await resumeMutation.mutateAsync(numericId);
            toast.success(t("resumed_toast"));
        } catch {
            // handled by hook
        }
    };

    const handleRetry = async () => {
        try {
            await retryMutation.mutateAsync(numericId);
            toast.success(t("retrying_toast"));
        } catch {
            // handled by hook
        }
    };

    const handleDelete = async () => {
        try {
            await deleteMutation.mutateAsync(numericId);
            toast.success(t("deleted_toast"));
        } catch {
            // handled by hook
        }
    };

    const showProgress =
        broadcast?.status === "SENDING" ||
        broadcast?.status === "PAUSED" ||
        broadcast?.status === "COMPLETED" ||
        broadcast?.status === "FAILED";

    const hasFailedRecipients = (broadcast?.stats?.failed ?? 0) > 0;

    if (isLoading) {
        return (
            <PageTransition className="flex min-h-0 flex-1 flex-col p-4">
                <div className="mb-6 flex items-center gap-3">
                    <Skeleton className="h-5 w-5" />
                    <Skeleton className="h-7 w-48" />
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-32 w-full rounded-lg" />
                    <Skeleton className="h-48 w-full rounded-lg" />
                    <Skeleton className="h-64 w-full rounded-lg" />
                </div>
            </PageTransition>
        );
    }

    if (!broadcast) {
        return (
            <PageTransition className="flex min-h-0 flex-1 flex-col items-center justify-center p-4">
                <p className="text-muted-foreground">{t("not_found")}</p>
                <Link to="/broadcasts" className="text-primary mt-2 text-sm hover:underline">
                    {t("back_to_list")}
                </Link>
            </PageTransition>
        );
    }

    const statusBadge = STATUS_BADGE_MAP[broadcast.status] ?? {
        variant: "secondary" as const,
        className: "",
    };

    return (
        <PageTransition className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2 md:p-4">
            {/* Header */}
            <div className="mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <Link to="/broadcasts">
                        <motion.button
                            type="button"
                            whileTap={{ scale: 0.9 }}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </motion.button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold md:text-2xl">{broadcast.name}</h1>
                            <Badge
                                variant={statusBadge.variant}
                                className={cn("text-xs", statusBadge.className)}
                            >
                                {t(`status_${broadcast.status.toLowerCase()}`)}
                            </Badge>
                        </div>
                        <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(broadcast.createdAt), "dd.MM.yyyy HH:mm")}
                            </span>
                            {broadcast.startedAt && (
                                <span>
                                    {t("started_at")}:{" "}
                                    {format(new Date(broadcast.startedAt), "HH:mm:ss")}
                                </span>
                            )}
                            {broadcast.completedAt && (
                                <span>
                                    {t("completed_at")}:{" "}
                                    {format(new Date(broadcast.completedAt), "HH:mm:ss")}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                    {canSend && broadcast.status === "DRAFT" && (
                        <motion.div whileTap={{ scale: 0.95 }}>
                            <Button
                                size="sm"
                                onClick={handleSend}
                                disabled={sendMutation.isPending}
                            >
                                <Send className="mr-1.5 h-4 w-4" />
                                {t("send")}
                            </Button>
                        </motion.div>
                    )}
                    {canUpdate && broadcast.status === "SENDING" && (
                        <motion.div whileTap={{ scale: 0.95 }}>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handlePause}
                                disabled={pauseMutation.isPending}
                            >
                                <Pause className="mr-1.5 h-4 w-4" />
                                {t("pause")}
                            </Button>
                        </motion.div>
                    )}
                    {canUpdate && broadcast.status === "PAUSED" && (
                        <motion.div whileTap={{ scale: 0.95 }}>
                            <Button
                                size="sm"
                                onClick={handleResume}
                                disabled={resumeMutation.isPending}
                            >
                                <Play className="mr-1.5 h-4 w-4" />
                                {t("resume")}
                            </Button>
                        </motion.div>
                    )}
                    {canSend &&
                        (broadcast.status === "COMPLETED" || broadcast.status === "FAILED") &&
                        hasFailedRecipients && (
                            <motion.div whileTap={{ scale: 0.95 }}>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleRetry}
                                    disabled={retryMutation.isPending}
                                >
                                    <RefreshCw className="mr-1.5 h-4 w-4" />
                                    {t("retry_failed")}
                                </Button>
                            </motion.div>
                        )}
                    {canDelete && (
                        <motion.div whileTap={{ scale: 0.95 }}>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setDeleteOpen(true)}
                                disabled={deleteMutation.isPending}
                            >
                                <Trash2 className="mr-1.5 h-4 w-4" />
                                {t("cancel")}
                            </Button>
                        </motion.div>
                    )}
                </div>
            </div>

            <div className="space-y-6">
                {/* Progress section */}
                <AnimatePresence>
                    {showProgress && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <Card>
                                <CardContent className="pt-6">
                                    <BroadcastProgress
                                        total={broadcast.stats?.total ?? 0}
                                        sent={broadcast.stats?.sent ?? 0}
                                        failed={broadcast.stats?.failed ?? 0}
                                        pending={broadcast.stats?.pending ?? 0}
                                        status={broadcast.status}
                                    />
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Message preview */}
                {/* Recipients */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">{t("recipients")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Tabs
                            value={recipientFilter}
                            onValueChange={(v) => setRecipientFilter(v as RecipientFilter)}
                        >
                            <TabsList className="mb-4">
                                <TabsTrigger value={RECIPIENT_STATUS_ALL}>
                                    {t("filter_all")} ({allRecipients.length})
                                </TabsTrigger>
                                <TabsTrigger value={RECIPIENT_STATUS_SENT}>
                                    {t("sent")} (
                                    {allRecipients.filter((r) => r.status === "SENT").length})
                                </TabsTrigger>
                                <TabsTrigger value={RECIPIENT_STATUS_FAILED}>
                                    {t("failed")} (
                                    {allRecipients.filter((r) => r.status === "FAILED").length})
                                </TabsTrigger>
                                <TabsTrigger value={RECIPIENT_STATUS_PENDING}>
                                    {t("pending")} (
                                    {allRecipients.filter((r) => r.status === "PENDING").length})
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value={recipientFilter} className="mt-0">
                                {recipientsLoading ? (
                                    <div className="space-y-2">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <Skeleton key={i} className="h-12 rounded-md" />
                                        ))}
                                    </div>
                                ) : filteredRecipients.length === 0 ? (
                                    <div className="flex items-center justify-center py-8">
                                        <p className="text-muted-foreground text-sm">
                                            {t("no_recipients")}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="divide-y rounded-lg border">
                                        {filteredRecipients.map((recipient) => {
                                            const rBadge = RECIPIENT_BADGE_MAP[
                                                recipient.status
                                            ] ?? {
                                                variant: "secondary" as const,
                                                className: "",
                                            };

                                            return (
                                                <div
                                                    key={recipient.id}
                                                    className="flex items-center justify-between px-3 py-2.5"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-medium">
                                                            {recipient.user?.fullname ??
                                                                `User #${recipient.userId}`}
                                                        </p>
                                                        {recipient.errorMessage && (
                                                            <p className="text-destructive truncate text-xs">
                                                                {recipient.errorMessage}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {recipient.sentAt && (
                                                            <span className="text-muted-foreground text-xs tabular-nums">
                                                                {format(
                                                                    new Date(recipient.sentAt),
                                                                    "HH:mm:ss",
                                                                )}
                                                            </span>
                                                        )}
                                                        <Badge
                                                            variant={rBadge.variant}
                                                            className={cn(
                                                                "text-xs",
                                                                rBadge.className,
                                                            )}
                                                        >
                                                            {t(recipient.status.toLowerCase())}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>

            {/* Delete confirmation */}
            <ConfirmDrawer
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                onConfirm={handleDelete}
                title={t("delete_title")}
                description={t("delete_description")}
                isLoading={deleteMutation.isPending}
            />
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/broadcasts/$broadcastId")({
    beforeLoad: async () => {
        const { permissions } = useAuthStore.getState();
        if (!hasPermission(permissions, Permission.BROADCASTS_READ)) {
            throw redirect({ to: "/" });
        }
    },
    component: BroadcastDetailPage,
});
