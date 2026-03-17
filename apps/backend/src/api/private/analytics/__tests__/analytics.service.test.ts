import { describe, test, expect, beforeEach, vi } from "vitest";
import {
	prismaMock,
	createMockLogger,
	expectSuccess,
} from "@backend/test/setup";
import { AnalyticsService } from "../analytics.service";
import type {
	CategorySalesData,
	DailySalesData,
} from "@jahonbozor/schemas/src/analytics";
import type {
	Order,
	OrderItem,
	Product,
	Category,
	Expense,
} from "@backend/generated/prisma/client";

// Factory functions for mock data
const createMockProduct = (overrides: Partial<Product> = {}): Product => ({
	id: 1,
	name: "Test Product",
	price: 100 as unknown as Product["price"],
	costprice: 50 as unknown as Product["costprice"],
	remaining: 10,
	categoryId: 1,
	deletedAt: null,
	createdAt: new Date("2024-01-01"),
	updatedAt: new Date("2024-01-01"),
	...overrides,
});

const createMockCategory = (overrides: Partial<Category> = {}): Category => ({
	id: 1,
	name: "Electronics",
	parentId: null,
	createdAt: new Date("2024-01-01"),
	updatedAt: new Date("2024-01-01"),
	...overrides,
});

const createMockOrderItem = (overrides: Partial<OrderItem> = {}): OrderItem => ({
	id: 1,
	orderId: 1,
	productId: 1,
	quantity: 2,
	price: 100 as unknown as OrderItem["price"],
	data: null,
	createdAt: new Date("2024-01-01"),
	updatedAt: new Date("2024-01-01"),
	...overrides,
});

const createMockOrder = (overrides: Partial<Order> = {}): Order => ({
	id: 1,
	userId: 1,
	staffId: 1,
	paymentType: "CASH",
	status: "NEW",
    comment: null,
	data: null,
	createdAt: new Date("2024-06-01T10:00:00Z"),
	updatedAt: new Date("2024-06-01T10:00:00Z"),
	...overrides,
});

const createMockExpense = (overrides: Partial<Expense> = {}): Expense => ({
	id: 1,
	name: "Office Rent",
	amount: 5000 as unknown as Expense["amount"],
	description: "Monthly rent payment",
	expenseDate: new Date("2024-06-01"),
	staffId: 1,
	deletedAt: null,
	createdAt: new Date("2024-01-01"),
	updatedAt: new Date("2024-01-01"),
	...overrides,
});

describe("AnalyticsService", () => {
	let mockLogger: ReturnType<typeof createMockLogger>;

	beforeEach(() => {
		mockLogger = createMockLogger();
	});

	describe("getAnalyticsSummary", () => {
		test("should return analytics for today by default", async () => {
			// Arrange
			const mockProduct = createMockProduct({ id: 1, name: "Laptop", categoryId: 1 });
			const mockOrderItem = createMockOrderItem({
				id: 1,
				productId: 1,
				quantity: 2,
				price: 1000 as unknown as OrderItem["price"],
			});
			const mockOrder = createMockOrder({
				id: 1,
				status: "NEW",
				createdAt: new Date(),
			});

			// @ts-expect-error - Adding product to OrderItem for include
			mockOrderItem.product = mockProduct;

			// @ts-expect-error - Adding items to Order for include
			mockOrder.items = [mockOrderItem];

			const mockExpense = createMockExpense({
				id: 1,
				amount: 500 as unknown as Expense["amount"],
				expenseDate: new Date(),
			});

			prismaMock.order.findMany.mockResolvedValue([mockOrder]);
			prismaMock.expense.findMany.mockResolvedValue([mockExpense]);
			prismaMock.category.findMany.mockResolvedValue([createMockCategory({ id: 1, name: "Electronics" })]);

			// Act
			const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

			// Assert
			const success = expectSuccess(result);
			expect(success.data!.overview.totalSales).toBe(2000); // 1000 * 2
			expect(success.data!.overview.totalExpenses).toBe(500);
			expect(success.data!.overview.profit).toBe(1500); // 2000 - 500
			expect(success.data!.overview.ordersCount).toBe(1);
		});

		test("should return analytics for custom date range", async () => {
			// Arrange
			const dateFrom = "2024-06-01T00:00:00.000Z";
			const dateTo = "2024-06-30T23:59:59.999Z";

			prismaMock.order.findMany.mockResolvedValue([]);
			prismaMock.expense.findMany.mockResolvedValue([]);
			prismaMock.category.findMany.mockResolvedValue([]);

			// Act
			const result = await AnalyticsService.getAnalyticsSummary(
				{ dateFrom, dateTo },
				mockLogger,
			);

			// Assert
			const success = expectSuccess(result);
			expect(success.data!.period.from).toBe(dateFrom);
			expect(success.data!.period.to).toBe(dateTo);
		});

		test("should calculate total sales from all orders regardless of status", async () => {
			// Arrange
			const mockProduct = createMockProduct();
			const orderNew = createMockOrder({ id: 1, status: "NEW", createdAt: new Date() });
			const orderAccepted = createMockOrder({ id: 2, status: "ACCEPTED", createdAt: new Date() });
			const orderCancelled = createMockOrder({ id: 3, status: "CANCELLED", createdAt: new Date() });

			const itemNew = createMockOrderItem({ orderId: 1, quantity: 1, price: 100 as unknown as OrderItem["price"] });
			const itemAccepted = createMockOrderItem({ orderId: 2, quantity: 2, price: 200 as unknown as OrderItem["price"] });
			const itemCancelled = createMockOrderItem({ orderId: 3, quantity: 1, price: 150 as unknown as OrderItem["price"] });

			// @ts-expect-error - Adding product to OrderItem for include
			itemNew.product = mockProduct;
			// @ts-expect-error - Adding product to OrderItem for include
			itemAccepted.product = mockProduct;
			// @ts-expect-error - Adding product to OrderItem for include
			itemCancelled.product = mockProduct;

			// @ts-expect-error - Adding items to Order for include
			orderNew.items = [itemNew];
			// @ts-expect-error - Adding items to Order for include
			orderAccepted.items = [itemAccepted];
			// @ts-expect-error - Adding items to Order for include
			orderCancelled.items = [itemCancelled];

			prismaMock.order.findMany.mockResolvedValue([orderNew, orderAccepted, orderCancelled]);
			prismaMock.expense.findMany.mockResolvedValue([]);
			prismaMock.category.findMany.mockResolvedValue([]);

			// Act
			const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

			// Assert
			const success = expectSuccess(result);
			// 100 + 400 + 150 = 650 (all orders regardless of status)
			expect(success.data!.overview.totalSales).toBe(650);
			expect(success.data!.overview.ordersCount).toBe(3);
		});

		test("should sum expenses excluding deleted ones", async () => {
			// Arrange
			const activeExpense1 = createMockExpense({
				id: 1,
				amount: 1000 as unknown as Expense["amount"],
				deletedAt: null,
			});
			const activeExpense2 = createMockExpense({
				id: 2,
				amount: 500 as unknown as Expense["amount"],
				deletedAt: null,
			});
			const deletedExpense = createMockExpense({
				id: 3,
				amount: 2000 as unknown as Expense["amount"],
				deletedAt: new Date(),
			});

			prismaMock.order.findMany.mockResolvedValue([]);
			// Only non-deleted expenses should be returned by query
			prismaMock.expense.findMany.mockResolvedValue([activeExpense1, activeExpense2]);
			prismaMock.category.findMany.mockResolvedValue([]);

			// Act
			const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

			// Assert
			const success = expectSuccess(result);
			expect(success.data!.overview.totalExpenses).toBe(1500); // 1000 + 500, deleted not included
		});

		test("should calculate profit correctly (sales - expenses)", async () => {
			// Arrange
			const mockProduct = createMockProduct();
			const mockOrderItem = createMockOrderItem({
				quantity: 5,
				price: 200 as unknown as OrderItem["price"],
			});
			// @ts-expect-error - Adding product to OrderItem for include
			mockOrderItem.product = mockProduct;

			const mockOrder = createMockOrder({ createdAt: new Date() });
			// @ts-expect-error - Adding items to Order for include
			mockOrder.items = [mockOrderItem];

			const mockExpense = createMockExpense({
				amount: 300 as unknown as Expense["amount"],
			});

			prismaMock.order.findMany.mockResolvedValue([mockOrder]);
			prismaMock.expense.findMany.mockResolvedValue([mockExpense]);
			prismaMock.category.findMany.mockResolvedValue([]);

			// Act
			const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

			// Assert
			const success = expectSuccess(result);
			expect(success.data!.overview.totalSales).toBe(1000); // 200 * 5
			expect(success.data!.overview.totalExpenses).toBe(300);
			expect(success.data!.overview.profit).toBe(700); // 1000 - 300
		});

		test("should return top 5 products by quantity", async () => {
			// Arrange
			const products = Array.from({ length: 7 }, (_, i) =>
				createMockProduct({ id: i + 1, name: `Product ${i + 1}`, categoryId: 1 }),
			);

			const orders = Array.from({ length: 7 }, (_, i) => {
				const order = createMockOrder({ id: i + 1, createdAt: new Date() });
				const item = createMockOrderItem({
					id: i + 1,
					orderId: i + 1,
					productId: i + 1,
					quantity: 10 - i, // Product 1 has 10, Product 2 has 9, etc.
					price: 100 as unknown as OrderItem["price"],
				});
				// @ts-expect-error - Adding product to OrderItem for include
				item.product = products[i];
				// @ts-expect-error - Adding items to Order for include
				order.items = [item];
				return order;
			});

			prismaMock.order.findMany.mockResolvedValue(orders);
			prismaMock.expense.findMany.mockResolvedValue([]);
			prismaMock.category.findMany.mockResolvedValue([]);

			// Act
			const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

			// Assert
			const success = expectSuccess(result);
			expect(success.data!.topProducts).toHaveLength(5);
			expect(success.data!.topProducts[0].productName).toBe("Product 1");
			expect(success.data!.topProducts[0].quantitySold).toBe(10);
			expect(success.data!.topProducts[4].productName).toBe("Product 5");
			expect(success.data!.topProducts[4].quantitySold).toBe(6);
		});

		test("should return category breakdown", async () => {
			// Arrange
			const category1 = createMockCategory({ id: 1, name: "Electronics" });
			const category2 = createMockCategory({ id: 2, name: "Clothing" });

			const product1 = createMockProduct({ id: 1, name: "Laptop", categoryId: 1 });
			const product2 = createMockProduct({ id: 2, name: "Phone", categoryId: 1 });
			const product3 = createMockProduct({ id: 3, name: "Shirt", categoryId: 2 });

			const order1 = createMockOrder({ id: 1, createdAt: new Date() });
			const order2 = createMockOrder({ id: 2, createdAt: new Date() });

			const item1 = createMockOrderItem({
				id: 1,
				orderId: 1,
				productId: 1,
				quantity: 2,
				price: 1000 as unknown as OrderItem["price"],
			});
			const item2 = createMockOrderItem({
				id: 2,
				orderId: 1,
				productId: 2,
				quantity: 1,
				price: 500 as unknown as OrderItem["price"],
			});
			const item3 = createMockOrderItem({
				id: 3,
				orderId: 2,
				productId: 3,
				quantity: 3,
				price: 50 as unknown as OrderItem["price"],
			});

			// @ts-expect-error - Adding product to OrderItem for include
			item1.product = product1;
			// @ts-expect-error - Adding product to OrderItem for include
			item2.product = product2;
			// @ts-expect-error - Adding product to OrderItem for include
			item3.product = product3;

			// @ts-expect-error - Adding items to Order for include
			order1.items = [item1, item2];
			// @ts-expect-error - Adding items to Order for include
			order2.items = [item3];

			prismaMock.order.findMany.mockResolvedValue([order1, order2]);
			prismaMock.expense.findMany.mockResolvedValue([]);
			prismaMock.category.findMany.mockResolvedValue([category1, category2]);

			// Act
			const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

			// Assert
			const success = expectSuccess(result);
			expect(success.data!.categoryBreakdown).toHaveLength(2);
			const electronics = success.data!.categoryBreakdown.find(
				(c: CategorySalesData) => c.categoryName === "Electronics",
			);
			const clothing = success.data!.categoryBreakdown.find(
				(c: CategorySalesData) => c.categoryName === "Clothing",
			);

			expect(electronics?.totalRevenue).toBe(2500); // (1000*2) + (500*1)
			expect(electronics?.orderCount).toBe(1); // order1
			expect(clothing?.totalRevenue).toBe(150); // 50*3
			expect(clothing?.orderCount).toBe(1); // order2
		});

		test("should handle empty data gracefully", async () => {
			// Arrange
			prismaMock.order.findMany.mockResolvedValue([]);
			prismaMock.expense.findMany.mockResolvedValue([]);
			prismaMock.category.findMany.mockResolvedValue([]);

			// Act
			const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

			// Assert
			const success = expectSuccess(result);
			expect(success.data!.overview.totalSales).toBe(0);
			expect(success.data!.overview.totalExpenses).toBe(0);
			expect(success.data!.overview.profit).toBe(0);
			expect(success.data!.overview.ordersCount).toBe(0);
			expect(success.data!.dailySales).toEqual([]);
			expect(success.data!.topProducts).toEqual([]);
			expect(success.data!.categoryBreakdown).toEqual([]);
		});

		test("should return daily breakdown with sales and expenses", async () => {
			// Arrange
			const mockProduct = createMockProduct();

			const order1 = createMockOrder({ id: 1, createdAt: new Date("2024-06-01T10:00:00Z") });
			const order2 = createMockOrder({ id: 2, createdAt: new Date("2024-06-02T14:00:00Z") });

			const item1 = createMockOrderItem({
				orderId: 1,
				quantity: 2,
				price: 100 as unknown as OrderItem["price"],
			});
			const item2 = createMockOrderItem({
				orderId: 2,
				quantity: 1,
				price: 300 as unknown as OrderItem["price"],
			});

			// @ts-expect-error - Adding product to OrderItem for include
			item1.product = mockProduct;
			// @ts-expect-error - Adding product to OrderItem for include
			item2.product = mockProduct;

			// @ts-expect-error - Adding items to Order for include
			order1.items = [item1];
			// @ts-expect-error - Adding items to Order for include
			order2.items = [item2];

			const expense1 = createMockExpense({
				id: 1,
				amount: 50 as unknown as Expense["amount"],
				expenseDate: new Date("2024-06-01T12:00:00Z"),
			});
			const expense2 = createMockExpense({
				id: 2,
				amount: 100 as unknown as Expense["amount"],
				expenseDate: new Date("2024-06-02T16:00:00Z"),
			});

			prismaMock.order.findMany.mockResolvedValue([order1, order2]);
			prismaMock.expense.findMany.mockResolvedValue([expense1, expense2]);
			prismaMock.category.findMany.mockResolvedValue([]);

			// Act
			const result = await AnalyticsService.getAnalyticsSummary(
				{
					dateFrom: "2024-06-01T00:00:00.000Z",
					dateTo: "2024-06-02T23:59:59.999Z",
				},
				mockLogger,
			);

			// Assert
			const success = expectSuccess(result);
			expect(success.data!.dailySales).toHaveLength(2);

			const day1 = success.data!.dailySales.find(
				(d: DailySalesData) => d.date === "2024-06-01",
			);
			const day2 = success.data!.dailySales.find(
				(d: DailySalesData) => d.date === "2024-06-02",
			);

			expect(day1?.totalSales).toBe(200); // 100 * 2
			expect(day1?.totalExpenses).toBe(50);
			expect(day1?.profit).toBe(150); // 200 - 50
			expect(day1?.totalOrders).toBe(1);

			expect(day2?.totalSales).toBe(300); // 300 * 1
			expect(day2?.totalExpenses).toBe(100);
			expect(day2?.profit).toBe(200); // 300 - 100
			expect(day2?.totalOrders).toBe(1);
		});

		test("should handle database error gracefully", async () => {
			// Arrange
			prismaMock.order.findMany.mockRejectedValue(new Error("DB connection failed"));

			// Act
			const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

			// Assert
			expect(result.success).toBe(false);
			expect(mockLogger.error).toHaveBeenCalled();
		});

		test("should count acceptedOrdersCount correctly with mixed statuses", async () => {
			// Arrange
			const mockProduct = createMockProduct();
			const orderNew = createMockOrder({ id: 1, status: "NEW", createdAt: new Date() });
			const orderAccepted1 = createMockOrder({ id: 2, status: "ACCEPTED", createdAt: new Date() });
			const orderAccepted2 = createMockOrder({ id: 3, status: "ACCEPTED", createdAt: new Date() });
			const orderCancelled = createMockOrder({ id: 4, status: "CANCELLED", createdAt: new Date() });

			const item = createMockOrderItem({ quantity: 1, price: 100 as unknown as OrderItem["price"] });
			// @ts-expect-error - Adding product to OrderItem for include
			item.product = mockProduct;

			for (const order of [orderNew, orderAccepted1, orderAccepted2, orderCancelled]) {
				// @ts-expect-error - Adding items to Order for include
				order.items = [{ ...item, orderId: order.id }];
			}

			prismaMock.order.findMany.mockResolvedValue([orderNew, orderAccepted1, orderAccepted2, orderCancelled]);
			prismaMock.expense.findMany.mockResolvedValue([]);
			prismaMock.category.findMany.mockResolvedValue([]);

			// Act
			const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

			// Assert
			const success = expectSuccess(result);
			expect(success.data!.overview.ordersCount).toBe(4);
			expect(success.data!.overview.acceptedOrdersCount).toBe(2);
		});

		test("should handle products without categories in categoryBreakdown", async () => {
			// Arrange — product with categoryId = null
			const productNoCategory = createMockProduct({ id: 1, name: "Uncategorized", categoryId: null as unknown as number });
			const item = createMockOrderItem({ productId: 1, quantity: 1, price: 100 as unknown as OrderItem["price"] });
			// @ts-expect-error - Adding product to OrderItem for include
			item.product = { ...productNoCategory, categoryId: null };

			const order = createMockOrder({ id: 1, createdAt: new Date() });
			// @ts-expect-error - Adding items to Order for include
			order.items = [item];

			prismaMock.order.findMany.mockResolvedValue([order]);
			prismaMock.expense.findMany.mockResolvedValue([]);
			prismaMock.category.findMany.mockResolvedValue([]);

			// Act
			const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

			// Assert — should not crash, categoryBreakdown should be empty
			const success = expectSuccess(result);
			expect(success.data!.categoryBreakdown).toHaveLength(0);
			expect(success.data!.overview.totalSales).toBe(100);
		});

		test("should sum same product quantities from multiple orders in topProducts", async () => {
			// Arrange — same product in 2 different orders
			const mockProduct = createMockProduct({ id: 1, name: "Popular Item", categoryId: 1 });

			const item1 = createMockOrderItem({ orderId: 1, productId: 1, quantity: 3, price: 100 as unknown as OrderItem["price"] });
			const item2 = createMockOrderItem({ orderId: 2, productId: 1, quantity: 5, price: 100 as unknown as OrderItem["price"] });
			// @ts-expect-error
			item1.product = mockProduct;
			// @ts-expect-error
			item2.product = mockProduct;

			const order1 = createMockOrder({ id: 1, createdAt: new Date() });
			const order2 = createMockOrder({ id: 2, createdAt: new Date() });
			// @ts-expect-error
			order1.items = [item1];
			// @ts-expect-error
			order2.items = [item2];

			prismaMock.order.findMany.mockResolvedValue([order1, order2]);
			prismaMock.expense.findMany.mockResolvedValue([]);
			prismaMock.category.findMany.mockResolvedValue([]);

			// Act
			const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

			// Assert
			const success = expectSuccess(result);
			expect(success.data!.topProducts).toHaveLength(1);
			expect(success.data!.topProducts[0].quantitySold).toBe(8); // 3 + 5
			expect(success.data!.topProducts[0].totalRevenue).toBe(800); // 100*3 + 100*5
		});

		test("should limit topProducts to 5 and exclude the rest", async () => {
			// Arrange — 8 products, should only return top 5
			const products = Array.from({ length: 8 }, (_, i) =>
				createMockProduct({ id: i + 1, name: `Product ${i + 1}`, categoryId: 1 }),
			);

			const orders = Array.from({ length: 8 }, (_, i) => {
				const order = createMockOrder({ id: i + 1, createdAt: new Date() });
				const item = createMockOrderItem({
					id: i + 1,
					orderId: i + 1,
					productId: i + 1,
					quantity: 20 - i, // Product 1 has 20, Product 2 has 19, etc.
					price: 50 as unknown as OrderItem["price"],
				});
				// @ts-expect-error
				item.product = products[i];
				// @ts-expect-error
				order.items = [item];
				return order;
			});

			prismaMock.order.findMany.mockResolvedValue(orders);
			prismaMock.expense.findMany.mockResolvedValue([]);
			prismaMock.category.findMany.mockResolvedValue([]);

			// Act
			const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

			// Assert
			const success = expectSuccess(result);
			expect(success.data!.topProducts).toHaveLength(5);
			expect(success.data!.topProducts[0].quantitySold).toBe(20);
			expect(success.data!.topProducts[4].quantitySold).toBe(16);
		});

		test("should aggregate multiple orders and expenses on the same day", async () => {
			// Arrange — 3 orders and 2 expenses on the same day
			const mockProduct = createMockProduct();
			const sameDay = new Date("2024-06-01T10:00:00Z");

			const orders = Array.from({ length: 3 }, (_, i) => {
				const order = createMockOrder({ id: i + 1, createdAt: sameDay });
				const item = createMockOrderItem({
					orderId: i + 1,
					quantity: 1,
					price: (100 * (i + 1)) as unknown as OrderItem["price"],
				});
				// @ts-expect-error
				item.product = mockProduct;
				// @ts-expect-error
				order.items = [item];
				return order;
			});

			const expenses = [
				createMockExpense({ id: 1, amount: 50 as unknown as Expense["amount"], expenseDate: sameDay }),
				createMockExpense({ id: 2, amount: 75 as unknown as Expense["amount"], expenseDate: sameDay }),
			];

			prismaMock.order.findMany.mockResolvedValue(orders);
			prismaMock.expense.findMany.mockResolvedValue(expenses);
			prismaMock.category.findMany.mockResolvedValue([]);

			// Act
			const result = await AnalyticsService.getAnalyticsSummary(
				{ dateFrom: "2024-06-01T00:00:00.000Z", dateTo: "2024-06-01T23:59:59.999Z" },
				mockLogger,
			);

			// Assert
			const success = expectSuccess(result);
			expect(success.data!.dailySales).toHaveLength(1);
			const day = success.data!.dailySales[0];
			expect(day.totalSales).toBe(600); // 100 + 200 + 300
			expect(day.totalOrders).toBe(3);
			expect(day.totalExpenses).toBe(125); // 50 + 75
			expect(day.profit).toBe(475); // 600 - 125
		});

		test("should handle negative profit when expenses exceed sales", async () => {
			// Arrange
			const mockProduct = createMockProduct();
			const item = createMockOrderItem({ quantity: 1, price: 100 as unknown as OrderItem["price"] });
			// @ts-expect-error
			item.product = mockProduct;

			const order = createMockOrder({ createdAt: new Date() });
			// @ts-expect-error
			order.items = [item];

			const bigExpense = createMockExpense({
				amount: 9999 as unknown as Expense["amount"],
			});

			prismaMock.order.findMany.mockResolvedValue([order]);
			prismaMock.expense.findMany.mockResolvedValue([bigExpense]);
			prismaMock.category.findMany.mockResolvedValue([]);

			// Act
			const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

			// Assert
			const success = expectSuccess(result);
			expect(success.data!.overview.totalSales).toBe(100);
			expect(success.data!.overview.totalExpenses).toBe(9999);
			expect(success.data!.overview.profit).toBe(-9899); // Negative profit
		});

		test("should handle orders with zero quantity items", async () => {
			// Arrange
			const mockProduct = createMockProduct();
			const item = createMockOrderItem({ quantity: 0, price: 500 as unknown as OrderItem["price"] });
			// @ts-expect-error
			item.product = mockProduct;

			const order = createMockOrder({ createdAt: new Date() });
			// @ts-expect-error
			order.items = [item];

			prismaMock.order.findMany.mockResolvedValue([order]);
			prismaMock.expense.findMany.mockResolvedValue([]);
			prismaMock.category.findMany.mockResolvedValue([]);

			// Act
			const result = await AnalyticsService.getAnalyticsSummary({}, mockLogger);

			// Assert
			const success = expectSuccess(result);
			expect(success.data!.overview.totalSales).toBe(0); // 500 * 0 = 0
			expect(success.data!.overview.ordersCount).toBe(1);
		});
	});
});
