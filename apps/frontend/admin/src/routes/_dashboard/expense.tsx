import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageTransition } from "@jahonbozor/ui";

function ExpensePage() {
    const { t } = useTranslation();

    return (
        <PageTransition className="p-6">
            <h1 className="text-2xl font-bold">{t("expense")}</h1>
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/expense")({
    component: ExpensePage,
});
