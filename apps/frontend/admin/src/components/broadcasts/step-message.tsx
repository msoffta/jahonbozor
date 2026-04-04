import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";

import { AnimatePresence, Button, cn, Input, motion, Skeleton, toast } from "@jahonbozor/ui";

import { templatesListQueryOptions, useCreateTemplate } from "@/api/templates.api";
import { InlineButtonBuilder } from "@/components/broadcasts/inline-button-builder";
import { TelegramRichEditor } from "@/components/broadcasts/telegram-rich-editor";

import type { InlineButton, SendVia, TemplateItem } from "./broadcast-types";

interface StepMessageContentProps {
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
}

export function StepMessageContent({
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
}: StepMessageContentProps) {
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
