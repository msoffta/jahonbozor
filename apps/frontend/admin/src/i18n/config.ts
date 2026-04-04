import { initReactI18next } from "react-i18next";

import i18n from "i18next";

import ruAnalytics from "@/i18n/ru/analytics.json";
import ruBroadcasts from "@/i18n/ru/broadcasts.json";
import ruClients from "@/i18n/ru/clients.json";
import ruCommon from "@/i18n/ru/common.json";
import ruExpenses from "@/i18n/ru/expenses.json";
import ruIncome from "@/i18n/ru/income.json";
import ruOrders from "@/i18n/ru/orders.json";
import ruProducts from "@/i18n/ru/products.json";
import ruSettings from "@/i18n/ru/settings.json";
import uzAnalytics from "@/i18n/uz/analytics.json";
import uzBroadcasts from "@/i18n/uz/broadcasts.json";
import uzClients from "@/i18n/uz/clients.json";
import uzCommon from "@/i18n/uz/common.json";
import uzExpenses from "@/i18n/uz/expenses.json";
import uzIncome from "@/i18n/uz/income.json";
import uzOrders from "@/i18n/uz/orders.json";
import uzProducts from "@/i18n/uz/products.json";
import uzSettings from "@/i18n/uz/settings.json";
import { useUIStore } from "@/stores/ui.store";

const resources = {
    uz: {
        common: uzCommon,
        products: uzProducts,
        expenses: uzExpenses,
        clients: uzClients,
        income: uzIncome,
        orders: uzOrders,
        settings: uzSettings,
        analytics: uzAnalytics,
        broadcasts: uzBroadcasts,
    },
    ru: {
        common: ruCommon,
        products: ruProducts,
        expenses: ruExpenses,
        clients: ruClients,
        income: ruIncome,
        orders: ruOrders,
        settings: ruSettings,
        analytics: ruAnalytics,
        broadcasts: ruBroadcasts,
    },
};

// Read persisted locale from UI store
const storedLocale = useUIStore.getState().locale;

void i18n.use(initReactI18next).init({
    resources,
    lng: storedLocale || "uz",
    defaultNS: "common",
    fallbackLng: "uz",
    interpolation: {
        escapeValue: false,
    },
});

// Sync i18n language when UI store locale changes
useUIStore.subscribe((state) => {
    if (i18n.language !== state.locale) {
        void i18n.changeLanguage(state.locale);
    }
});

export { i18n };
