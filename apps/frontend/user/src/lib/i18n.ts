import { initReactI18next } from "react-i18next";

import i18n from "i18next";

import ruCart from "@/locales/ru/cart.json";
import ruCatalog from "@/locales/ru/catalog.json";
import ruCommon from "@/locales/ru/common.json";
import ruOrders from "@/locales/ru/orders.json";
import ruProfile from "@/locales/ru/profile.json";
import uzCart from "@/locales/uz/cart.json";
import uzCatalog from "@/locales/uz/catalog.json";
import uzCommon from "@/locales/uz/common.json";
import uzOrders from "@/locales/uz/orders.json";
import uzProfile from "@/locales/uz/profile.json";
import { useUIStore } from "@/stores/ui.store";

const resources = {
    uz: {
        common: uzCommon,
        catalog: uzCatalog,
        orders: uzOrders,
        cart: uzCart,
        profile: uzProfile,
    },
    ru: {
        common: ruCommon,
        catalog: ruCatalog,
        orders: ruOrders,
        cart: ruCart,
        profile: ruProfile,
    },
};

// Read persisted locale from UI store
const storedLocale = useUIStore.getState().locale;

void i18n.use(initReactI18next).init({
    resources,
    lng: storedLocale || "uz",
    defaultNS: "common",
    fallbackNS: "common",
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
