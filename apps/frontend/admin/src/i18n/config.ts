import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { useUIStore } from "@/stores/ui.store";

import uzCommon from "@/i18n/uz/common.json";
import ruCommon from "@/i18n/ru/common.json";
import uzProducts from "@/i18n/uz/products.json";
import ruProducts from "@/i18n/ru/products.json";
import uzExpenses from "@/i18n/uz/expenses.json";
import ruExpenses from "@/i18n/ru/expenses.json";

const resources = {
    uz: { common: uzCommon, products: uzProducts, expenses: uzExpenses },
    ru: { common: ruCommon, products: ruProducts, expenses: ruExpenses },
};

// Read persisted locale from UI store
const storedLocale = useUIStore.getState().locale;

i18n.use(initReactI18next).init({
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
        i18n.changeLanguage(state.locale);
    }
});

export default i18n;
