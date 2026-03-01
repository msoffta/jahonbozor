import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

function SummaryPage() {
    const { t } = useTranslation();

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold">{t("summary")}</h1>
        </div>
    );
}

export const Route = createFileRoute("/_dashboard/summary")({
    component: SummaryPage,
});
