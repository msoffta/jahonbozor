import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

function SettingsPage() {
    const { t } = useTranslation();

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold">{t("settings")}</h1>
        </div>
    );
}

export const Route = createFileRoute("/_dashboard/settings")({
    component: SettingsPage,
});
