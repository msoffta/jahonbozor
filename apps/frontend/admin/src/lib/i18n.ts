import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import uzCommon from "@/locales/uz/common.json";
import ruCommon from "@/locales/ru/common.json";

const resources = {
    uz: { common: uzCommon },
    ru: { common: ruCommon },
};

i18n.use(initReactI18next).init({
    resources,
    lng: "uz",
    defaultNS: "common",
    fallbackLng: "uz",
    interpolation: {
        escapeValue: false,
    },
});

export default i18n;
