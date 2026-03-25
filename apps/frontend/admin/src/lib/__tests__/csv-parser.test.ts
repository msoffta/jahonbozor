import { describe, expect, test } from "vitest";

import { parseProductsCsv } from "../csv-parser";

describe("parseProductsCsv", () => {
    test("should parse valid CSV with header and data rows", () => {
        const csv = [
            "Товары,Цена для клиента,Себестоимость,Остаток,Продажа,Приход,Остаток,,,,Сумма себестоимости",
            "Product A,40000,27300,2,0,,2,,,,,54 600",
            "Product B,15000,9100,66,3,,63,,,,,573 300",
        ].join("\n");

        const result = parseProductsCsv(csv);

        expect(result.products).toHaveLength(2);
        expect(result.products[0]).toEqual({
            name: "Product A",
            price: 40000,
            costprice: 27300,
            remaining: 2,
        });
        expect(result.products[1]).toEqual({
            name: "Product B",
            price: 15000,
            costprice: 9100,
            remaining: 63,
        });
        expect(result.errors).toHaveLength(0);
    });

    test("should skip empty rows before header", () => {
        const csv = [
            ",,,,,,,,,,",
            ",,,,,,,,,,",
            ",,,,,,,,,,",
            "Товары,Цена для клиента,Себестоимость,Остаток,Продажа,Приход,Остаток,,,,Сумма себестоимости",
            "Product A,10000,5000,5,0,,5,,,,,25000",
        ].join("\n");

        const result = parseProductsCsv(csv);

        expect(result.products).toHaveLength(1);
        expect(result.products[0].name).toBe("Product A");
    });

    test("should handle comma as thousands separator (3+ digits after comma)", () => {
        // "543,866" should be parsed as 543866 (thousands separator)
        const csv = [
            "Товары,Цена для клиента,Себестоимость,Остаток,Продажа,Приход,Остаток",
            '"Bolt gayka",35000,19200,"543,866","9,64",,"534,226"',
        ].join("\n");

        const result = parseProductsCsv(csv);

        expect(result.products).toHaveLength(1);
        // remaining from col 6: "534,226" → 534226
        expect(result.products[0].remaining).toBe(534226);
    });

    test("should handle negative remaining values", () => {
        const csv = [
            "Товары,Цена для клиента,Себестоимость,Остаток,Продажа,Приход,Остаток",
            "Trimer nasadka,-18000,12000,-22,0,,-22",
        ].join("\n");

        const result = parseProductsCsv(csv);

        // Price is negative → skip as error
        expect(result.products).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
    });

    test("should allow negative remaining with valid price", () => {
        const csv = [
            "Товары,Цена для клиента,Себестоимость,Остаток,Продажа,Приход,Остаток",
            "Trimer nasadka,18000,12000,-22,0,,-22",
        ].join("\n");

        const result = parseProductsCsv(csv);

        expect(result.products).toHaveLength(1);
        expect(result.products[0].remaining).toBe(-22);
    });

    test("should skip rows with empty name", () => {
        const csv = [
            "Товары,Цена для клиента,Себестоимость,Остаток,Продажа,Приход,Остаток",
            ",10000,5000,5,0,,5",
            "Valid Product,10000,5000,5,0,,5",
        ].join("\n");

        const result = parseProductsCsv(csv);

        expect(result.products).toHaveLength(1);
        expect(result.products[0].name).toBe("Valid Product");
    });

    test("should report error for invalid price", () => {
        const csv = [
            "Товары,Цена для клиента,Себестоимость,Остаток,Продажа,Приход,Остаток",
            "Product A,abc,5000,5,0,,5",
        ].join("\n");

        const result = parseProductsCsv(csv);

        expect(result.products).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain("price");
    });

    test("should report error for invalid costprice", () => {
        const csv = [
            "Товары,Цена для клиента,Себестоимость,Остаток,Продажа,Приход,Остаток",
            "Product A,10000,xyz,5,0,,5",
        ].join("\n");

        const result = parseProductsCsv(csv);

        expect(result.products).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain("costprice");
    });

    test("should default remaining to 0 when col 6 is empty", () => {
        const csv = [
            "Товары,Цена для клиента,Себестоимость,Остаток,Продажа,Приход,Остаток",
            "Product A,10000,5000,5,0,,",
        ].join("\n");

        const result = parseProductsCsv(csv);

        expect(result.products).toHaveLength(1);
        expect(result.products[0].remaining).toBe(0);
    });

    test("should parse CSV without header (no Товары row)", () => {
        const csv = ["Product A,10000,5000,5,0,,5", "Product B,20000,10000,3,0,,3"].join("\n");

        const result = parseProductsCsv(csv);

        expect(result.products).toHaveLength(2);
    });

    test("should handle empty CSV", () => {
        const result = parseProductsCsv("");

        expect(result.products).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
    });

    test("should handle CSV with only header and empty rows", () => {
        const csv = [
            ",,,,,,,,,,",
            "Товары,Цена для клиента,Себестоимость,Остаток,Продажа,Приход,Остаток,,,,Сумма себестоимости",
        ].join("\n");

        const result = parseProductsCsv(csv);

        expect(result.products).toHaveLength(0);
    });

    test("should trim product names", () => {
        const csv = [
            "Товары,Цена для клиента,Себестоимость,Остаток,Продажа,Приход,Остаток",
            "  Spaced Name  ,10000,5000,5,0,,5",
        ].join("\n");

        const result = parseProductsCsv(csv);

        expect(result.products[0].name).toBe("Spaced Name");
    });

    test("should handle real-world CSV format with dollar prices and percentages", () => {
        const csv = [
            ",,,,,,,,,,",
            ",,,,,,,,,,",
            "Товары,Цена для клиента,Себестоимость,Остаток,Продажа,Приход,Остаток,,,,Сумма себестоимости",
            'PENA PISTALET QORA,40000,27300,2,0,,2,"2,1$",,,54 600',
            'Shit Viko 24,180000,139080,8,3,,5,"11,4$",-5%,,695 400',
        ].join("\n");

        const result = parseProductsCsv(csv);

        expect(result.products).toHaveLength(2);
        expect(result.products[0]).toEqual({
            name: "PENA PISTALET QORA",
            price: 40000,
            costprice: 27300,
            remaining: 2,
        });
        expect(result.products[1]).toEqual({
            name: "Shit Viko 24",
            price: 180000,
            costprice: 139080,
            remaining: 5,
        });
    });

    test("should return totalRows count", () => {
        const csv = [
            "Товары,Цена для клиента,Себестоимость,Остаток,Продажа,Приход,Остаток",
            "Product A,10000,5000,5,0,,5",
            "Product B,20000,10000,3,0,,3",
            ",invalid,,,,", // will be skipped (empty name)
        ].join("\n");

        const result = parseProductsCsv(csv);

        expect(result.totalRows).toBe(3); // 3 data rows attempted
        expect(result.products).toHaveLength(2); // 2 valid
    });

    test("should handle quoted fields with commas inside (product name)", () => {
        const csv = [
            "Товары,Цена для клиента,Себестоимость,Остаток,Продажа,Приход,Остаток",
            '"646 1,5 l TU",20000,15000,200,18,,182',
        ].join("\n");

        const result = parseProductsCsv(csv);

        expect(result.products).toHaveLength(1);
        expect(result.products[0].name).toBe("646 1,5 l TU");
        expect(result.products[0].price).toBe(20000);
        expect(result.products[0].remaining).toBe(182);
    });

    test("should skip rows with zero price", () => {
        const csv = [
            "Товары,Цена для клиента,Себестоимость,Остаток,Продажа,Приход,Остаток",
            "Free Product,0,0,5,0,,5",
        ].join("\n");

        const result = parseProductsCsv(csv);

        expect(result.products).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
    });
});
