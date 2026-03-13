import { z } from "@jahonbozor/schemas";
import i18next from "i18next";

export const initZodI18n = () => {
	const customErrorMap: z.ZodErrorMap = (issue, ctx) => {
		let message: string;

		switch (issue.code) {
			case z.ZodIssueCode.invalid_type:
				if (issue.received === "undefined" || issue.received === "null") {
					message = i18next.t("common:validation.required");
				} else {
					message = i18next.t("common:validation.invalid_type");
				}
				break;
			case z.ZodIssueCode.too_small:
				message = i18next.t("common:validation.too_small", {
					count: issue.minimum,
				});
				break;
			case z.ZodIssueCode.too_big:
				message = i18next.t("common:validation.too_big", {
					count: issue.maximum,
				});
				break;
			case z.ZodIssueCode.invalid_string:
				if (issue.validation === "email") {
					message = i18next.t("common:validation.invalid_email");
				} else if (issue.validation === "url") {
					message = i18next.t("common:validation.invalid_url");
				} else if (issue.validation === "uuid") {
					message = i18next.t("common:validation.invalid_uuid");
				} else {
					message = i18next.t("common:validation.invalid_string");
				}
				break;
			case z.ZodIssueCode.invalid_date:
				message = i18next.t("common:validation.invalid_date");
				break;
			default:
				message = ctx.defaultError;
		}

		return { message };
	};

	z.setErrorMap(customErrorMap);
};
