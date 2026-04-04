import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";

import { hasPermission, Permission } from "@jahonbozor/schemas";
import { AnimatePresence, Button, motion, PageTransition, toast } from "@jahonbozor/ui";

import { useCreateBroadcast } from "@/api/broadcasts.api";
import { sessionsListQueryOptions } from "@/api/sessions.api";
import { templatesListQueryOptions } from "@/api/templates.api";
import { StepIndicator } from "@/components/broadcasts/step-indicator";
import { StepMessageContent } from "@/components/broadcasts/step-message";
import { StepRecipients } from "@/components/broadcasts/step-recipients";
import { StepSchedule } from "@/components/broadcasts/step-schedule";
import { StepSendMethod } from "@/components/broadcasts/step-send-method";
import { useAuthStore } from "@/stores/auth.store";

import type {
    InlineButton,
    SendVia,
    SessionItem,
    TemplateItem,
} from "@/components/broadcasts/broadcast-types";

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
