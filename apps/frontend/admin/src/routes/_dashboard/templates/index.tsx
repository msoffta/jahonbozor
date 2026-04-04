import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { format } from "date-fns";
import { FileText, Plus } from "lucide-react";

import { hasPermission, Permission } from "@jahonbozor/schemas";
import {
    AnimatePresence,
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    motion,
    PageTransition,
    Skeleton,
} from "@jahonbozor/ui";

import { templatesListQueryOptions } from "@/api/templates.api";
import { TemplateDrawer } from "@/components/broadcasts/template-drawer";
import { useHasPermission } from "@/hooks/use-permissions";
import { useAuthStore } from "@/stores/auth.store";

const CONTENT_PREVIEW_LENGTH = 100;

interface BroadcastTemplateItem {
    id: number;
    name: string;
    content: string;
    media?: string | null;
    buttons?: string | null;
    createdAt: string;
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").trim();
}

function parseButtonCount(buttonsJson?: string | null): number {
    if (!buttonsJson) return 0;
    try {
        const parsed: unknown = JSON.parse(buttonsJson);
        return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
        return 0;
    }
}

function TemplateCardSkeleton() {
    return (
        <Card>
            <CardHeader className="pb-2">
                <Skeleton className="h-5 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex items-center justify-between pt-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                </div>
            </CardContent>
        </Card>
    );
}

function TemplatesPage() {
    const { t } = useTranslation("broadcasts");
    const canCreate = useHasPermission(Permission.BROADCAST_TEMPLATES_CREATE);
    const canUpdate = useHasPermission(Permission.BROADCAST_TEMPLATES_UPDATE);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<BroadcastTemplateItem | null>(null);

    const { data, isLoading } = useQuery(templatesListQueryOptions());

    const templates = useMemo(
        () => (data?.templates ?? []) as unknown as BroadcastTemplateItem[],
        [data],
    );

    const handleCardClick = (template: BroadcastTemplateItem) => {
        if (!canUpdate) return;
        setSelectedTemplate(template);
        setDrawerOpen(true);
    };

    const handleCreate = () => {
        setSelectedTemplate(null);
        setDrawerOpen(true);
    };

    return (
        <PageTransition className="flex min-h-0 flex-1 flex-col p-2 md:p-4">
            <div className="mb-4 flex items-center justify-between md:mb-6">
                <h1 className="text-xl font-bold md:text-2xl">{t("templates_title")}</h1>
                {canCreate && (
                    <motion.div whileTap={{ scale: 0.95 }}>
                        <Button onClick={handleCreate} size="sm">
                            <Plus className="mr-1.5 h-4 w-4" />
                            {t("create_template")}
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
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    >
                        {Array.from({ length: 6 }).map((_, i) => (
                            <TemplateCardSkeleton key={i} />
                        ))}
                    </motion.div>
                ) : templates.length === 0 ? (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-1 flex-col items-center justify-center gap-4 py-20"
                    >
                        <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-full">
                            <FileText className="text-muted-foreground h-8 w-8" />
                        </div>
                        <p className="text-muted-foreground text-sm">{t("templates_empty")}</p>
                        {canCreate && (
                            <Button variant="outline" onClick={handleCreate} size="sm">
                                <Plus className="mr-1.5 h-4 w-4" />
                                {t("create_template")}
                            </Button>
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
                        {templates.map((template, index) => {
                            const preview = stripHtml(template.content);
                            const truncated =
                                preview.length > CONTENT_PREVIEW_LENGTH
                                    ? preview.slice(0, CONTENT_PREVIEW_LENGTH) + "..."
                                    : preview;
                            const buttonCount = parseButtonCount(template.buttons);

                            return (
                                <motion.div
                                    key={template.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    whileTap={canUpdate ? { scale: 0.98 } : undefined}
                                >
                                    <Card
                                        className={
                                            canUpdate
                                                ? "cursor-pointer transition-shadow hover:shadow-md"
                                                : ""
                                        }
                                        onClick={() => handleCardClick(template)}
                                    >
                                        <CardHeader className="pb-2">
                                            <CardTitle className="truncate text-base">
                                                {template.name}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-muted-foreground mb-3 line-clamp-2 text-sm">
                                                {truncated || "---"}
                                            </p>
                                            <div className="flex items-center justify-between">
                                                {buttonCount > 0 && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        {buttonCount}{" "}
                                                        {buttonCount === 1
                                                            ? t("button_text")
                                                            : t("template_buttons")}
                                                    </Badge>
                                                )}
                                                <span className="text-muted-foreground ml-auto text-xs">
                                                    {format(
                                                        new Date(template.createdAt),
                                                        "dd.MM.yyyy",
                                                    )}
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>

            <TemplateDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                template={selectedTemplate}
            />
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/templates/")({
    beforeLoad: async () => {
        const { permissions } = useAuthStore.getState();
        if (!hasPermission(permissions, Permission.BROADCAST_TEMPLATES_LIST)) {
            throw redirect({ to: "/" });
        }
    },
    component: TemplatesPage,
});
