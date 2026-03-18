import { describe, expect, test } from "vitest";

import {
    createCategorySnapshot,
    createExpenseSnapshot,
    createOrderSnapshot,
    createProductSnapshot,
    createRoleSnapshot,
    createStaffSnapshot,
    createUserSnapshot,
} from "../snapshots";

describe("Snapshot Functions", () => {
    describe("createOrderSnapshot", () => {
        test("should extract order fields", () => {
            const order = {
                userId: 1,
                staffId: 2,
                paymentType: "CASH" as const,
                comment: "Rush order",
                data: { source: "web" },
            };

            expect(createOrderSnapshot(order)).toEqual({
                userId: 1,
                staffId: 2,
                paymentType: "CASH",
                comment: "Rush order",
                data: { source: "web" },
            });
        });

        test("should include items with numeric price when present", () => {
            const order = {
                userId: 1,
                staffId: null,
                paymentType: "DEBT" as const,
                comment: null,
                data: null,
                items: [
                    { productId: 10, quantity: 3, price: "150.50" },
                    { productId: 20, quantity: 1, price: 200 },
                ],
            };

            const snapshot = createOrderSnapshot(order);
            expect(snapshot.items).toEqual([
                { productId: 10, quantity: 3, price: 150.5 },
                { productId: 20, quantity: 1, price: 200 },
            ]);
        });

        test("should omit items when not present", () => {
            const order = {
                userId: null,
                staffId: 1,
                paymentType: "CREDIT_CARD" as const,
                comment: null,
                data: null,
            };

            const snapshot = createOrderSnapshot(order);
            expect(snapshot).not.toHaveProperty("items");
        });
    });

    describe("createProductSnapshot", () => {
        test("should extract product fields with numeric conversions", () => {
            const product = {
                id: 1,
                name: "Laptop",
                price: "999.99",
                costprice: "500.00",
                categoryId: 5,
                remaining: 10,
                deletedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            expect(createProductSnapshot(product as never)).toEqual({
                name: "Laptop",
                price: 999.99,
                costprice: 500,
                categoryId: 5,
                remaining: 10,
            });
        });
    });

    describe("createExpenseSnapshot", () => {
        test("should extract expense fields with numeric amount", () => {
            const expenseDate = new Date("2024-06-15");
            const expense = {
                id: 1,
                name: "Office Rent",
                amount: "5000.00",
                description: "Monthly rent",
                expenseDate,
                staffId: 3,
                deletedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            expect(createExpenseSnapshot(expense as never)).toEqual({
                name: "Office Rent",
                amount: 5000,
                description: "Monthly rent",
                expenseDate,
                staffId: 3,
            });
        });
    });

    describe("createUserSnapshot", () => {
        test("should extract user fields", () => {
            const user = {
                id: 42,
                fullname: "John Doe",
                username: "johndoe",
                phone: "+998901234567",
                photo: "https://example.com/photo.jpg",
                telegramId: BigInt(123456789),
                language: "uz",
                passwordHash: "should-not-appear",
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const snapshot = createUserSnapshot(user as never);
            expect(snapshot).toEqual({
                id: 42,
                fullname: "John Doe",
                username: "johndoe",
                phone: "+998901234567",
                photo: "https://example.com/photo.jpg",
                telegramId: BigInt(123456789),
                language: "uz",
            });
            expect(snapshot).not.toHaveProperty("passwordHash");
        });
    });

    describe("createStaffSnapshot", () => {
        test("should extract staff fields with telegramId as string", () => {
            const staff = {
                fullname: "Admin User",
                username: "admin",
                roleId: 1,
                telegramId: BigInt(987654321),
            };

            expect(createStaffSnapshot(staff)).toEqual({
                fullname: "Admin User",
                username: "admin",
                roleId: 1,
                telegramId: "987654321",
            });
        });

        test("should handle null telegramId", () => {
            const staff = {
                fullname: "No Telegram",
                username: "notg",
                roleId: 2,
                telegramId: null,
            };

            expect(createStaffSnapshot(staff)).toEqual({
                fullname: "No Telegram",
                username: "notg",
                roleId: 2,
                telegramId: null,
            });
        });

        test("should handle undefined telegramId", () => {
            const staff = {
                fullname: "No TG",
                username: "notg2",
                roleId: 3,
            };

            expect(createStaffSnapshot(staff)).toEqual({
                fullname: "No TG",
                username: "notg2",
                roleId: 3,
                telegramId: null,
            });
        });
    });

    describe("createCategorySnapshot", () => {
        test("should extract category fields", () => {
            expect(createCategorySnapshot({ id: 1, name: "Electronics", parentId: null })).toEqual({
                id: 1,
                name: "Electronics",
                parentId: null,
            });
        });

        test("should include parentId when present", () => {
            expect(createCategorySnapshot({ id: 5, name: "Phones", parentId: 1 })).toEqual({
                id: 5,
                name: "Phones",
                parentId: 1,
            });
        });
    });

    describe("createRoleSnapshot", () => {
        test("should extract role fields", () => {
            expect(
                createRoleSnapshot({
                    name: "Admin",
                    permissions: ["PRODUCTS_VIEW", "ORDERS_VIEW"],
                }),
            ).toEqual({
                name: "Admin",
                permissions: ["PRODUCTS_VIEW", "ORDERS_VIEW"],
            });
        });

        test("should handle empty permissions", () => {
            expect(createRoleSnapshot({ name: "Viewer", permissions: [] })).toEqual({
                name: "Viewer",
                permissions: [],
            });
        });
    });
});
