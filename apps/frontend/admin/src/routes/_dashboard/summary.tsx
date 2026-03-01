import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageTransition } from "@jahonbozor/ui";

function SummaryPage() {
    const { t } = useTranslation();

    return (
        <PageTransition className="p-6">
            <h1 className="text-2xl font-bold">{t("summary")}</h1>
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/summary")({
    component: SummaryPage,
});
