import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

function CartPage() {
    const { t } = useTranslation();

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold">{t("cart")}</h1>
        </div>
    );
}

export const Route = createFileRoute("/_user/cart")({
    component: CartPage,
});
