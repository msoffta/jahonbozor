import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { useUIStore } from "@/stores/ui.store";

import uzCommon from "@/locales/uz/common.json";
import ruCommon from "@/locales/ru/common.json";

const resources = {
    uz: { common: uzCommon },
    ru: { common: ruCommon },
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
