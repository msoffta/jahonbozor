import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bot, Check, Plus, Smartphone, Wifi } from "lucide-react";

import { AnimatePresence, Button, Card, CardContent, cn, motion, Skeleton } from "@jahonbozor/ui";

import { sessionsListQueryOptions } from "@/api/sessions.api";

import type { SendVia, SessionItem } from "./broadcast-types";

interface StepSendMethodProps {
    sendVia: SendVia;
    setSendVia: (v: SendVia) => void;
    selectedSessionId: number | null;
    setSelectedSessionId: (id: number | null) => void;
}

export function StepSendMethod({
    sendVia,
    setSendVia,
    selectedSessionId,
    setSelectedSessionId,
}: StepSendMethodProps) {
    const { t } = useTranslation("broadcasts");
    const { data, isLoading } = useQuery(sessionsListQueryOptions());

    const activeSessions = useMemo(
        () =>
            (data?.sessions ?? []).filter(
                (s: SessionItem) => s.status === "ACTIVE",
            ) as SessionItem[],
        [data],
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                        setSendVia("BOT");
                        setSelectedSessionId(null);
                    }}
                    className={cn(
                        "flex flex-col items-center gap-3 rounded-xl border p-6 text-center transition-all",
                        sendVia === "BOT"
                            ? "border-primary bg-primary/5 ring-primary/20 ring-2"
                            : "border-border hover:border-primary/50",
                    )}
                >
                    <div
                        className={cn(
                            "flex h-14 w-14 items-center justify-center rounded-full",
                            sendVia === "BOT"
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground",
                        )}
                    >
                        <Bot className="h-7 w-7" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold">{t("send_via_bot")}</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                            {t("send_via_bot_desc")}
                        </p>
                    </div>
                </motion.button>

                <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSendVia("SESSION")}
                    className={cn(
                        "flex flex-col items-center gap-3 rounded-xl border p-6 text-center transition-all",
                        sendVia === "SESSION"
                            ? "border-primary bg-primary/5 ring-primary/20 ring-2"
                            : "border-border hover:border-primary/50",
                    )}
                >
                    <div
                        className={cn(
                            "flex h-14 w-14 items-center justify-center rounded-full",
                            sendVia === "SESSION"
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground",
                        )}
                    >
                        <Smartphone className="h-7 w-7" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold">{t("send_via_session")}</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                            {t("send_via_session_desc")}
                        </p>
                    </div>
                </motion.button>
            </div>

            <AnimatePresence>
                {sendVia === "SESSION" && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3 overflow-hidden"
                    >
                        <label className="text-sm font-medium">{t("select_session")}</label>

                        {isLoading ? (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={`sk-${i}`} className="h-20 rounded-lg" />
                                ))}
                            </div>
                        ) : activeSessions.length === 0 ? (
                            <Card>
                                <CardContent className="flex flex-col items-center gap-3 py-8">
                                    <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
                                        <Wifi className="text-muted-foreground h-6 w-6" />
                                    </div>
                                    <p className="text-muted-foreground text-sm">
                                        {t("no_active_sessions")}
                                    </p>
                                    <Button variant="outline" size="sm" asChild>
                                        <Link to="/sessions">
                                            <Plus className="mr-1.5 h-4 w-4" />
                                            {t("add_session")}
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {activeSessions.map((session) => (
                                    <motion.button
                                        key={session.id}
                                        type="button"
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => setSelectedSessionId(session.id)}
                                        className={cn(
                                            "rounded-lg border p-4 text-left transition-all",
                                            selectedSessionId === session.id
                                                ? "border-primary bg-primary/5 ring-primary/20 ring-2"
                                                : "border-border hover:border-primary/50",
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Wifi className="text-primary h-4 w-4 shrink-0" />
                                            <span className="truncate text-sm font-medium">
                                                {session.name}
                                            </span>
                                            {selectedSessionId === session.id && (
                                                <Check className="text-primary ml-auto h-4 w-4 shrink-0" />
                                            )}
                                        </div>
                                        <p className="text-muted-foreground mt-1 text-xs">
                                            {session.phone}
                                        </p>
                                    </motion.button>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
