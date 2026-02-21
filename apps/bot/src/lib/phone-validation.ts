/**
 * Validates phone number format (E.164-like).
 * Accepts formats: +998901234567, 998901234567, +1 234 567-8900
 * Must be 10-15 digits after stripping non-numeric chars.
 */
export function validatePhone(phone: string): boolean {
    const digits = phone.replace(/[^0-9]/g, "");
    return digits.length >= 10 && digits.length <= 15;
}

/**
 * Normalizes phone number to a consistent format.
 * Ensures leading + and strips spaces/dashes/parentheses.
 */
export function normalizePhone(phone: string): string {
    const cleaned = phone.replace(/[^0-9+]/g, "");
    if (cleaned.startsWith("+")) {
        return cleaned;
    }
    return `+${cleaned}`;
}
