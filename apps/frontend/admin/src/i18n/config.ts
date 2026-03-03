import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { useUIStore } from "@/stores/ui.store";

import uzCommon from "@/i18n/uz/common.json";
import ruCommon from "@/i18n/ru/common.json";
import uzProducts from "@/i18n/uz/products.json";
import ruProducts from "@/i18n/ru/products.json";

const resources = {
    uz: { common: uzCommon, products: uzProducts },
    ru: { common: ruCommon, products: ruProducts },
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
