export function getLocaleCode(locale: "uz" | "ru"): string {
    return locale === "uz" ? "uz-UZ" : "ru-RU";
}

export function formatPrice(price: number, locale: string): string {
    return price.toLocaleString(locale).replace(/,/g, " ");
}

export function formatDate(dateStr: Date | string, locale: string): string {
    return new Date(dateStr).toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
