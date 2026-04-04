import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useForm } from "@tanstack/react-form";

import {
    Button,
    Drawer,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    Input,
    ScrollArea,
    toast,
} from "@jahonbozor/ui";

import { useCreateTemplate, useDeleteTemplate, useUpdateTemplate } from "@/api/templates.api";
import { FieldError } from "@/components/forms/field-error";

import { InlineButtonBuilder } from "./inline-button-builder";
import { TelegramRichEditor } from "./telegram-rich-editor";

interface BroadcastTemplateItem {
    id: number;
    name: string;
    content: string;
    media?: string | null;
    buttons?: string | null;
    createdAt: string;
}

interface TemplateDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    template?: BroadcastTemplateItem | null;
}

interface InlineButton {
    text: string;
    url: string;
}

function parseButtons(buttonsJson?: string | null): InlineButton[] {
    if (!buttonsJson) return [];
    try {
        const parsed: unknown = JSON.parse(buttonsJson);
        if (Array.isArray(parsed)) return parsed as InlineButton[];
        return [];
    } catch {
        return [];
    }
}

export function TemplateDrawer({ open, onOpenChange, template }: TemplateDrawerProps) {
    const { t } = useTranslation("broadcasts");
    const isEditing = !!template;

    const createTemplate = useCreateTemplate();
    const updateTemplate = useUpdateTemplate();
    const deleteTemplate = useDeleteTemplate();

    const [content, setContent] = useState("");
    const [buttons, setButtons] = useState<InlineButton[]>([]);

    useEffect(() => {
        if (open) {
            setContent(template?.content ?? "");
            setButtons(parseButtons(template?.buttons));
        }
    }, [open, template]);

    const form = useForm({
        defaultValues: {
            name: template?.name ?? "",
        },
        onSubmit: async ({ value }) => {
            const buttonsData = buttons.length > 0 ? buttons : undefined;

            if (isEditing && template) {
                await updateTemplate.mutateAsync({
                    id: template.id,
                    name: value.name,
                    content,
                    buttons: buttonsData,
                });
                toast.success(t("common:saved"));
            } else {
                await createTemplate.mutateAsync({
                    name: value.name,
                    content,
                    buttons: buttonsData,
                });
                toast.success(t("common:saved"));
            }

            onOpenChange(false);
        },
    });

    // Reset form default values when template changes
    useEffect(() => {
        if (open) {
            form.reset();
            form.setFieldValue("name", template?.name ?? "");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, template]);

    const handleDelete = async () => {
        if (!template) return;
        await deleteTemplate.mutateAsync(template.id);
        toast.success(t("common:deleted"));
        onOpenChange(false);
    };

    const isSaving = createTemplate.isPending || updateTemplate.isPending;
    const isDeleting = deleteTemplate.isPending;

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="max-h-[90vh]">
                <DrawerHeader>
                    <DrawerTitle>
                        {isEditing ? t("edit_template") : t("create_template")}
                    </DrawerTitle>
                </DrawerHeader>

                <ScrollArea className="flex-1 px-6">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void form.handleSubmit();
                        }}
                        id="template-form"
                        className="space-y-5 py-4"
                    >
                        <form.Field
                            name="name"
                            validators={{
                                onBlur: ({ value }) =>
                                    !value?.trim() ? t("common:required") : undefined,
                            }}
                            children={(field) => (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-foreground/70 block px-0.5 text-sm font-semibold">
                                        {t("template_name")}
                                    </label>
                                    <Input
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        placeholder={t("template_name")}
                                    />
                                    <FieldError field={field} />
                                </div>
                            )}
                        />

                        <div className="flex flex-col gap-1.5">
                            <label className="text-foreground/70 block px-0.5 text-sm font-semibold">
                                {t("template_content")}
                            </label>
                            <TelegramRichEditor
                                content={content}
                                onChange={setContent}
                                placeholder={t("template_content")}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-foreground/70 block px-0.5 text-sm font-semibold">
                                {t("template_buttons")}
                            </label>
                            <InlineButtonBuilder buttons={buttons} onChange={setButtons} />
                        </div>
                    </form>
                </ScrollArea>

                <DrawerFooter className="border-t">
                    <div className="flex w-full gap-3">
                        {isEditing && (
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={isSaving || isDeleting}
                                className="flex-1"
                            >
                                {isDeleting ? t("common:deleting") : t("template_delete")}
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSaving}
                            className="flex-1"
                        >
                            {t("common:cancel")}
                        </Button>
                        <Button
                            type="submit"
                            form="template-form"
                            disabled={isSaving}
                            className="flex-1"
                        >
                            {isSaving ? t("common:saving") : t("template_save")}
                        </Button>
                    </div>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
