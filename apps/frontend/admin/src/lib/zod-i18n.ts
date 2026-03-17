import i18next from "i18next";

import { z } from "@jahonbozor/schemas";

export const initZodI18n = () => {
    z.config({
        customError: (issue) => {
            switch (issue.code) {
                case "invalid_type":
                    if (issue.received === "undefined" || issue.received === "null") {
                        return i18next.t("common:validation.required");
                    }
                    if (issue.expected === "date") {
                        return i18next.t("common:validation.invalid_date");
                    }
                    return i18next.t("common:validation.invalid_type");

                case "too_small":
                    return i18next.t("common:validation.too_small", {
                        // Конвертируем bigint в number для i18next
                        count: Number(issue.minimum),
                    });

                case "too_big":
                    return i18next.t("common:validation.too_big", {
                        // Конвертируем bigint в number для i18next
                        count: Number(issue.maximum),
                    });

                case "invalid_format":
                    if (issue.format === "email") {
                        return i18next.t("common:validation.invalid_email");
                    }
                    if (issue.format === "url") {
                        return i18next.t("common:validation.invalid_url");
                    }
                    if (issue.format === "uuid") {
                        return i18next.t("common:validation.invalid_uuid");
                    }
                    if (issue.format === "date") {
                        return i18next.t("common:validation.invalid_date");
                    }
                    return i18next.t("common:validation.invalid_string");

                default:
                    return undefined;
            }
        },
    });
};
