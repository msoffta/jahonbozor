import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import {
    ArrowLeft,
    ArrowRight,
    Bot,
    Calendar,
    Check,
    MessageSquare,
    Plus,
    Radio,
    Search,
    Send,
    Smartphone,
    Users,
    Wifi,
} from "lucide-react";

import { hasPermission, Permission } from "@jahonbozor/schemas";
import {
    AnimatePresence,
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Checkbox,
    cn,
    DatePicker,
    Input,
    motion,
    PageTransition,
    ScrollArea,
    Separator,
    Skeleton,
    toast,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@jahonbozor/ui";

import { useCreateBroadcast } from "@/api/broadcasts.api";
import { clientsInfiniteQueryOptions } from "@/api/clients.api";
import { sessionsListQueryOptions } from "@/api/sessions.api";
import { templatesListQueryOptions, useCreateTemplate } from "@/api/templates.api";
import { InlineButtonBuilder } from "@/components/broadcasts/inline-button-builder";
import { TelegramRichEditor } from "@/components/broadcasts/telegram-rich-editor";
import { useAuthStore } from "@/stores/auth.store";

// --- Step constants ---
const STEP_SEND_METHOD = 0 as const;
const STEP_RECIPIENTS = 1 as const;
const STEP_MESSAGE = 2 as const;
const STEP_SCHEDULE = 3 as const;

type StepIndex =
    | typeof STEP_SEND_METHOD
    | typeof STEP_RECIPIENTS
    | typeof STEP_MESSAGE
    | typeof STEP_SCHEDULE;

const TOTAL_STEPS = 4;
const SEARCH_DEBOUNCE_MS = 300;

type SendVia = "BOT" | "SESSION";

interface InlineButton {
    text: string;
    url: string;
}

interface TemplateItem {
    id: number;
    name: string;
    content: string;
    media?: string | null;
    buttons?: string | null;
}

interface SessionItem {
    id: number;
    name: string;
    phone: string;
    status: string;
}

// --- Step Indicator ---

function StepIndicator({ currentStep }: { currentStep: StepIndex }) {
    const { t } = useTranslation("broadcasts");

    const steps = [
        { label: t("step_send_method"), icon: Radio },
        { label: t("step_recipients"), icon: Users },
        { label: t("step_message"), icon: MessageSquare },
        { label: t("step_schedule"), icon: Calendar },
    ];

    return (
        <div className="flex items-center justify-center gap-2 px-4 py-4 sm:gap-4">
            {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;

                return (
                    <div key={index} className="flex items-center gap-2 sm:gap-4">
                        {index > 0 && (
                            <div
                                className={cn(
                                    "hidden h-px w-6 sm:block sm:w-10",
                                    isCompleted ? "bg-primary" : "bg-muted",
                                )}
                            />
                        )}
                        <div className="flex flex-col items-center gap-1">
                            <motion.div
                                initial={false}
                                animate={{
                                    scale: isActive ? 1.1 : 1,
                                    backgroundColor:
                                        isActive || isCompleted
                                            ? "var(--color-primary)"
                                            : "var(--color-muted)",
                                }}
                                className={cn(
                                    "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                                    isActive || isCompleted
                                        ? "text-primary-foreground"
                                        : "text-muted-foreground",
                                )}
                            >
                                {isCompleted ? (
                                    <Check className="h-4 w-4" />
                                ) : (
                                    <Icon className="h-4 w-4" />
                                )}
                            </motion.div>
                            <span
                                className={cn(
                                    "hidden text-xs sm:block",
                                    isActive
                                        ? "text-foreground font-medium"
                                        : "text-muted-foreground",
                                )}
                            >
                                {step.label}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// --- Step 0: Send Method ---

function StepSendMethod({
    sendVia,
    setSendVia,
    selectedSessionId,
    setSelectedSessionId,
}: {
    sendVia: SendVia;
    setSendVia: (v: SendVia) => void;
    selectedSessionId: number | null;
    setSelectedSessionId: (id: number | null) => void;
}) {
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
                {/* BOT card */}
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

                {/* SESSION card */}
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

            {/* Session picker (only when SESSION is selected) */}
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
                                    <Skeleton key={i} className="h-20 rounded-lg" />
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

// --- Step 1: Recipients ---

function StepRecipients({
    sendVia,
    selectedIds,
    setSelectedIds,
}: {
    sendVia: SendVia;
    selectedIds: Set<number>;
    setSelectedIds: React.Dispatch<React.SetStateAction<Set<number>>>;
}) {
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

// --- Step 2: Message ---

function StepMessageContent({
    useTemplate,
    setUseTemplate,
    selectedTemplateId,
    setSelectedTemplateId,
    content,
    setContent,
    buttons,
    setButtons,
    name,
    setName,
    sendVia,
}: {
    useTemplate: boolean;
    setUseTemplate: (v: boolean) => void;
    selectedTemplateId: number | null;
    setSelectedTemplateId: (id: number | null) => void;
    content: string;
    setContent: (v: string) => void;
    buttons: InlineButton[];
    setButtons: (v: InlineButton[]) => void;
    name: string;
    setName: (v: string) => void;
    sendVia: SendVia;
}) {
    const { t } = useTranslation("broadcasts");
    const createTemplate = useCreateTemplate();

    const { data: templatesData, isLoading: templatesLoading } = useQuery(
        templatesListQueryOptions(),
    );

    const templates = useMemo(
        () => (templatesData?.templates ?? []) as unknown as TemplateItem[],
        [templatesData],
    );

    const handleSelectTemplate = (tpl: TemplateItem) => {
        setSelectedTemplateId(tpl.id);
        setContent(tpl.content);
        if (!name.trim()) {
            setName(tpl.name);
        }
        try {
            const parsed: unknown =
                typeof tpl.buttons === "string" ? JSON.parse(tpl.buttons) : tpl.buttons;
            setButtons(Array.isArray(parsed) ? (parsed as InlineButton[]) : []);
        } catch {
            setButtons([]);
        }
    };

    const handleSaveAsTemplate = async () => {
        if (!content.replace(/<[^>]*>/g, "").trim()) return;

        try {
            await createTemplate.mutateAsync({
                name: name.trim() || t("custom_message"),
                content,
                buttons: buttons.length > 0 ? buttons : null,
            });
            toast.success(t("template_saved_toast"));
        } catch {
            // Error handled by mutation hook
        }
    };

    return (
        <div className="space-y-6">
            {/* Name field */}
            <div className="space-y-2">
                <label className="text-sm font-medium">{t("name")}</label>
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("name")}
                />
            </div>

            {/* Toggle template / compose */}
            <div className="flex gap-2">
                <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setUseTemplate(true)}
                    className={cn(
                        "rounded-lg border px-4 py-2 text-sm transition-colors",
                        useTemplate
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50",
                    )}
                >
                    {t("use_template")}
                </motion.button>
                <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setUseTemplate(false)}
                    className={cn(
                        "rounded-lg border px-4 py-2 text-sm transition-colors",
                        !useTemplate
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50",
                    )}
                >
                    {t("compose_new")}
                </motion.button>
            </div>

            <div className="space-y-4">
                <AnimatePresence mode="wait">
                    {useTemplate ? (
                        <motion.div
                            key="templates"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="space-y-3"
                        >
                            <label className="text-sm font-medium">{t("select_template")}</label>
                            {templatesLoading ? (
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <Skeleton key={i} className="h-20 rounded-lg" />
                                    ))}
                                </div>
                            ) : templates.length === 0 ? (
                                <p className="text-muted-foreground text-sm">
                                    {t("templates_empty")}
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {templates.map((tpl) => (
                                        <motion.button
                                            key={tpl.id}
                                            type="button"
                                            whileTap={{ scale: 0.97 }}
                                            onClick={() => handleSelectTemplate(tpl)}
                                            className={cn(
                                                "rounded-lg border p-3 text-left transition-all",
                                                selectedTemplateId === tpl.id
                                                    ? "border-primary bg-primary/5 ring-primary/20 ring-2"
                                                    : "border-border hover:border-primary/50",
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="truncate text-sm font-medium">
                                                    {tpl.name}
                                                </span>
                                                {selectedTemplateId === tpl.id && (
                                                    <Check className="text-primary h-4 w-4 shrink-0" />
                                                )}
                                            </div>
                                            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                                                {tpl.content.replace(/<[^>]*>/g, "").slice(0, 80)}
                                            </p>
                                        </motion.button>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="compose"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-4"
                        >
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    {t("message_content")}
                                </label>
                                <TelegramRichEditor
                                    content={content}
                                    onChange={setContent}
                                    placeholder={t("message_placeholder")}
                                />
                            </div>

                            {sendVia === "BOT" && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">
                                        {t("inline_buttons")}
                                    </label>
                                    <InlineButtonBuilder buttons={buttons} onChange={setButtons} />
                                </div>
                            )}

                            {/* Save as template */}
                            <motion.div whileTap={{ scale: 0.95 }}>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSaveAsTemplate}
                                    disabled={
                                        createTemplate.isPending ||
                                        !content.replace(/<[^>]*>/g, "").trim()
                                    }
                                >
                                    <Plus className="mr-1.5 h-4 w-4" />
                                    {t("template_save_as")}
                                </Button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

// --- Step 3: Schedule ---

function StepSchedule({
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
}: {
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
}) {
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

// --- Main Page ---

function NewBroadcastPage() {
    const { t } = useTranslation("broadcasts");
    const navigate = useNavigate();
    const createBroadcast = useCreateBroadcast();

    // Step state
    const [currentStep, setCurrentStep] = useState<StepIndex>(STEP_SEND_METHOD);

    // Step 0 state
    const [sendVia, setSendVia] = useState<SendVia>("BOT");
    const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

    // Step 1 state
    const [selectedRecipientIds, setSelectedRecipientIds] = useState<Set<number>>(new Set());

    // Step 2 state
    const [name, setName] = useState("");
    const [useTemplate, setUseTemplate] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [content, setContent] = useState("");
    const [buttons, setButtons] = useState<InlineButton[]>([]);

    // Step 3 state
    const [sendNow, setSendNow] = useState(true);
    const [scheduledAt, setScheduledAt] = useState<Date | undefined>(undefined);

    // Session data for summary
    const { data: sessionsData } = useQuery(sessionsListQueryOptions());
    const selectedSession = useMemo(
        () =>
            ((sessionsData?.sessions ?? []) as SessionItem[]).find(
                (s) => s.id === selectedSessionId,
            ),
        [sessionsData, selectedSessionId],
    );

    // Template data for summary
    const { data: templatesData } = useQuery(templatesListQueryOptions());
    const selectedTemplateName = useMemo(() => {
        if (!selectedTemplateId) return null;
        const tpl = ((templatesData?.templates ?? []) as unknown as TemplateItem[]).find(
            (t) => t.id === selectedTemplateId,
        );
        return tpl?.name ?? null;
    }, [templatesData, selectedTemplateId]);

    // Validation
    const canGoNext = useMemo(() => {
        switch (currentStep) {
            case STEP_SEND_METHOD:
                if (sendVia === "BOT") return true;
                return selectedSessionId !== null;
            case STEP_RECIPIENTS:
                return selectedRecipientIds.size > 0;
            case STEP_MESSAGE:
                if (!name.trim()) return false;
                if (useTemplate) return selectedTemplateId !== null;
                return content.replace(/<[^>]*>/g, "").trim().length > 0;
            case STEP_SCHEDULE:
                return sendNow || scheduledAt !== undefined;
            default:
                return false;
        }
    }, [
        currentStep,
        sendVia,
        selectedSessionId,
        selectedRecipientIds.size,
        name,
        useTemplate,
        selectedTemplateId,
        content,
        sendNow,
        scheduledAt,
    ]);

    const handleNext = () => {
        if (currentStep < TOTAL_STEPS - 1) {
            setCurrentStep((currentStep + 1) as StepIndex);
        }
    };

    const handleBack = () => {
        if (currentStep > STEP_SEND_METHOD) {
            setCurrentStep((currentStep - 1) as StepIndex);
        }
    };

    const handleSubmit = async () => {
        const body = {
            name: name.trim(),
            content: useTemplate ? undefined : content,
            buttons: buttons.length > 0 ? buttons : undefined,
            templateId: useTemplate ? (selectedTemplateId ?? undefined) : undefined,
            sendVia,
            sessionId: sendVia === "SESSION" ? selectedSessionId! : undefined,
            recipientUserIds: Array.from(selectedRecipientIds),
            scheduledAt: sendNow ? undefined : scheduledAt?.toISOString(),
        };

        try {
            const result = await createBroadcast.mutateAsync(body);
            toast.success(t("created_toast"));
            const broadcastId = (result as { id: number }).id;
            void navigate({
                to: "/broadcasts/$broadcastId",
                params: { broadcastId: String(broadcastId) },
            });
        } catch {
            // Error handled by mutation hook
        }
    };

    const isLastStep = currentStep === STEP_SCHEDULE;

    return (
        <PageTransition className="flex min-h-0 flex-1 flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 border-b px-4 py-3">
                <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => navigate({ to: "/broadcasts" })}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </motion.button>
                <h1 className="text-lg font-bold">{t("new_title")}</h1>
            </div>

            {/* Step indicator */}
            <StepIndicator currentStep={currentStep} />

            {/* Step content */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
                <AnimatePresence mode="wait">
                    {currentStep === STEP_SEND_METHOD && (
                        <motion.div
                            key="step-send-method"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <StepSendMethod
                                sendVia={sendVia}
                                setSendVia={setSendVia}
                                selectedSessionId={selectedSessionId}
                                setSelectedSessionId={setSelectedSessionId}
                            />
                        </motion.div>
                    )}
                    {currentStep === STEP_RECIPIENTS && (
                        <motion.div
                            key="step-recipients"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <StepRecipients
                                sendVia={sendVia}
                                selectedIds={selectedRecipientIds}
                                setSelectedIds={setSelectedRecipientIds}
                            />
                        </motion.div>
                    )}
                    {currentStep === STEP_MESSAGE && (
                        <motion.div
                            key="step-message"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <StepMessageContent
                                useTemplate={useTemplate}
                                setUseTemplate={setUseTemplate}
                                selectedTemplateId={selectedTemplateId}
                                setSelectedTemplateId={setSelectedTemplateId}
                                content={content}
                                setContent={setContent}
                                buttons={buttons}
                                setButtons={setButtons}
                                name={name}
                                setName={setName}
                                sendVia={sendVia}
                            />
                        </motion.div>
                    )}
                    {currentStep === STEP_SCHEDULE && (
                        <motion.div
                            key="step-schedule"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <StepSchedule
                                sendNow={sendNow}
                                setSendNow={setSendNow}
                                scheduledAt={scheduledAt}
                                setScheduledAt={setScheduledAt}
                                name={name}
                                recipientCount={selectedRecipientIds.size}
                                sendVia={sendVia}
                                sessionName={selectedSession?.name ?? ""}
                                useTemplate={useTemplate}
                                templateName={selectedTemplateName}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer navigation */}
            <div className="flex items-center justify-between border-t px-4 pt-3 pb-16 md:pb-20">
                <motion.div whileTap={{ scale: 0.95 }}>
                    <Button
                        variant="outline"
                        onClick={handleBack}
                        disabled={currentStep === STEP_SEND_METHOD}
                    >
                        <ArrowLeft className="mr-1.5 h-4 w-4" />
                        {t("back")}
                    </Button>
                </motion.div>

                <motion.div whileTap={{ scale: 0.95 }}>
                    {isLastStep ? (
                        <Button
                            onClick={handleSubmit}
                            disabled={!canGoNext || createBroadcast.isPending}
                        >
                            <Send className="mr-1.5 h-4 w-4" />
                            {sendNow ? t("send_action") : t("schedule_action")}
                        </Button>
                    ) : (
                        <Button onClick={handleNext} disabled={!canGoNext}>
                            {t("next")}
                            <ArrowRight className="ml-1.5 h-4 w-4" />
                        </Button>
                    )}
                </motion.div>
            </div>
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/broadcasts/new")({
    beforeLoad: async () => {
        const { permissions } = useAuthStore.getState();
        if (!hasPermission(permissions, Permission.BROADCASTS_CREATE)) {
            throw redirect({ to: "/" });
        }
    },
    component: NewBroadcastPage,
});
