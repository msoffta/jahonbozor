import { describe, test, expect } from "bun:test";
import { validatePhone, normalizePhone } from "@bot/lib/phone-validation";

describe("validatePhone", () => {
    test("accepts valid phone with + prefix", () => {
        expect(validatePhone("+998901234567")).toBe(true);
    });

    test("accepts valid phone without + prefix", () => {
        expect(validatePhone("998901234567")).toBe(true);
    });

    test("accepts phone with spaces and dashes", () => {
        expect(validatePhone("+998 90 123-45-67")).toBe(true);
    });

    test("accepts minimum length phone (10 digits)", () => {
        expect(validatePhone("1234567890")).toBe(true);
    });

    test("accepts maximum length phone (15 digits)", () => {
        expect(validatePhone("123456789012345")).toBe(true);
    });

    test("accepts phone with parentheses", () => {
        expect(validatePhone("+1 (234) 567-8900")).toBe(true);
    });

    test("rejects phone shorter than 10 digits", () => {
        expect(validatePhone("12345")).toBe(false);
    });

    test("rejects phone longer than 15 digits", () => {
        expect(validatePhone("1234567890123456")).toBe(false);
    });

    test("rejects empty string", () => {
        expect(validatePhone("")).toBe(false);
    });

    test("rejects string with only letters", () => {
        expect(validatePhone("abcdefghij")).toBe(false);
    });

    test("rejects string with mixed letters and short digits", () => {
        expect(validatePhone("abc123")).toBe(false);
    });
});

describe("normalizePhone", () => {
    test("adds + prefix when missing", () => {
        expect(normalizePhone("998901234567")).toBe("+998901234567");
    });

    test("preserves existing + prefix", () => {
        expect(normalizePhone("+998901234567")).toBe("+998901234567");
    });

    test("removes spaces", () => {
        expect(normalizePhone("+998 90 123 45 67")).toBe("+998901234567");
    });

    test("removes dashes", () => {
        expect(normalizePhone("+998-90-123-45-67")).toBe("+998901234567");
    });

    test("removes parentheses", () => {
        expect(normalizePhone("+1 (234) 567-8900")).toBe("+12345678900");
    });

    test("handles phone without prefix and with formatting", () => {
        expect(normalizePhone("998 90 123-45-67")).toBe("+998901234567");
    });
});
