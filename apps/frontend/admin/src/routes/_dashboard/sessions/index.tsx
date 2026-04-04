import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { hasPermission, Permission } from "@jahonbozor/schemas";
import { AnimatePresence, Button, motion, PageTransition, Skeleton } from "@jahonbozor/ui";

import { sessionsListQueryOptions } from "@/api/sessions.api";
import { AddSessionDrawer } from "@/components/sessions/add-session-drawer";
import { SessionCard } from "@/components/sessions/session-card";
import { useHasPermission } from "@/hooks/use-permissions";
import { useAuthStore } from "@/stores/auth.store";

function SessionsPage() {
    const { t } = useTranslation("broadcasts");
    const [addOpen, setAddOpen] = useState(false);

    const canCreate = useHasPermission(Permission.TELEGRAM_SESSIONS_CREATE);

    const { data, isLoading } = useQuery(sessionsListQueryOptions());

    const sessions = data?.sessions ?? [];

    return (
        <PageTransition className="flex min-h-0 flex-1 flex-col p-2 md:p-4">
            <div className="mb-4 flex items-center justify-between md:mb-6">
                <h1 className="text-xl font-bold md:text-2xl">{t("sessions_title")}</h1>
                {canCreate && (
                    <motion.div whileTap={{ scale: 0.95 }}>
                        <Button size="sm" onClick={() => setAddOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            {t("add_session")}
                        </Button>
                    </motion.div>
                )}
            </div>

            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div
                        key="skeleton"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                    >
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="rounded-lg border p-4">
                                <Skeleton className="mb-3 h-5 w-32" />
                                <Skeleton className="mb-2 h-4 w-24" />
                                <Skeleton className="mb-2 h-4 w-20" />
                                <Skeleton className="h-4 w-28" />
                            </div>
                        ))}
                    </motion.div>
                ) : sessions.length === 0 ? (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex flex-1 flex-col items-center justify-center gap-4 py-20"
                    >
                        <p className="text-muted-foreground text-sm">{t("sessions_empty")}</p>
                        {canCreate && (
                            <motion.div whileTap={{ scale: 0.95 }}>
                                <Button variant="outline" onClick={() => setAddOpen(true)}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    {t("add_session")}
                                </Button>
                            </motion.div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                    >
                        {sessions.map((session, index) => (
                            <motion.div
                                key={session.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 25,
                                    delay: index * 0.05,
                                }}
                            >
                                <SessionCard session={session} />
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            <AddSessionDrawer open={addOpen} onOpenChange={setAddOpen} />
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/sessions/")({
    beforeLoad: async () => {
        const { permissions } = useAuthStore.getState();
        if (!hasPermission(permissions, Permission.TELEGRAM_SESSIONS_LIST)) {
            throw redirect({ to: "/" });
        }
    },
    component: SessionsPage,
});
