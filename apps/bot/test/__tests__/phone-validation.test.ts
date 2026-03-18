import { describe, expect, test } from "vitest";

import { normalizePhone, validatePhone } from "@bot/lib/phone-validation";

describe("validatePhone", () => {
    test.each([
        ["+998901234567", "valid phone with + prefix"],
        ["998901234567", "valid phone without + prefix"],
        ["+998 90 123-45-67", "phone with spaces and dashes"],
        ["1234567890", "minimum length phone (10 digits)"],
        ["123456789012345", "maximum length phone (15 digits)"],
        ["+1 (234) 567-8900", "phone with parentheses"],
    ])("accepts %s (%s)", (phone) => {
        expect(validatePhone(phone)).toBe(true);
    });

    test.each([
        ["12345", "phone shorter than 10 digits"],
        ["1234567890123456", "phone longer than 15 digits"],
        ["", "empty string"],
        ["abcdefghij", "string with only letters"],
        ["abc123", "string with mixed letters and short digits"],
        ["+", "just a plus sign"],
        ["+---//()", "only special characters"],
        ["123456789", "9 digits (boundary below minimum)"],
        ["1234567890123456", "16 digits (boundary above maximum)"],
    ])("rejects %s (%s)", (phone) => {
        expect(validatePhone(phone)).toBe(false);
    });
});

describe("normalizePhone", () => {
    test.each([
        ["998901234567", "+998901234567", "adds + prefix when missing"],
        ["+998901234567", "+998901234567", "preserves existing + prefix"],
        ["+998 90 123 45 67", "+998901234567", "removes spaces"],
        ["+998-90-123-45-67", "+998901234567", "removes dashes"],
        ["+1 (234) 567-8900", "+12345678900", "removes parentheses"],
        ["998 90 123-45-67", "+998901234567", "handles phone without prefix and with formatting"],
        ["  +998901234567  ", "+998901234567", "strips leading and trailing whitespace"],
    ])("normalizes %s → %s (%s)", (input, expected) => {
        expect(normalizePhone(input)).toBe(expected);
    });
});
