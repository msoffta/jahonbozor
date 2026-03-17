import { describe, test, expect, beforeEach, vi } from "vitest";
import type { QueryFunctionContext } from "@tanstack/react-query";

interface MockEdenResponse {
	data: Record<string, unknown> | null;
	error: Record<string, unknown> | null;
}

type ListQueryFnContext = QueryFunctionContext<
	readonly ["staff", "list", Record<string, unknown> | undefined]
>;
type DetailQueryFnContext = QueryFunctionContext<
	readonly ["staff", "detail", number]
>;

const { mockGet, mockGetById, mockPost, mockPatch, mockDelete } = vi.hoisted(() => ({
	mockGet: vi.fn(
		(): Promise<MockEdenResponse> =>
			Promise.resolve({
				data: {
					success: true,
					data: {
						count: 2,
						staff: [
							{
								id: 1,
								fullname: "John Doe",
								username: "john",
								roleId: 1,
								role: { id: 1, name: "Admin", permissions: ["staff:read:all"] },
								createdAt: "2026-01-01",
							},
							{
								id: 2,
								fullname: "Jane Smith",
								username: "jane",
								roleId: 2,
								role: { id: 2, name: "Manager", permissions: ["staff:read:own"] },
								createdAt: "2026-01-02",
							},
						],
					},
				},
				error: null,
			}),
	),
	mockGetById: vi.fn(
		(): Promise<MockEdenResponse> =>
			Promise.resolve({
				data: {
					success: true,
					data: {
						id: 1,
						fullname: "John Doe",
						username: "john",
						roleId: 1,
						role: { id: 1, name: "Admin", permissions: ["staff:read:all"] },
						createdAt: "2026-01-01",
					},
				},
				error: null,
			}),
	),
	mockPost: vi.fn(
		(): Promise<MockEdenResponse> =>
			Promise.resolve({
				data: {
					success: true,
					data: {
						id: 3,
						fullname: "New Staff",
						username: "newstaff",
						roleId: 1,
						telegramId: "",
						createdAt: "2026-01-03",
					},
				},
				error: null,
			}),
	),
	mockPatch: vi.fn(
		(): Promise<MockEdenResponse> =>
			Promise.resolve({
				data: {
					success: true,
					data: {
						id: 1,
						fullname: "Updated Name",
						username: "john",
						roleId: 1,
					},
				},
				error: null,
			}),
	),
	mockDelete: vi.fn(
		(): Promise<MockEdenResponse> =>
			Promise.resolve({
				data: {
					success: true,
					data: { id: 1, fullname: "John Doe", deletedAt: "2026-01-01" },
				},
				error: null,
			}),
	),
}));

vi.mock("@/api/client", () => ({
	api: {
		api: {
			private: {
				staff: Object.assign(
					(_params: { id: number }) => ({
						get: mockGetById,
						patch: mockPatch,
						delete: mockDelete,
					}),
					{ get: mockGet, post: mockPost },
				),
			},
		},
	},
}));

// --- Imports AFTER mocks ---
import {
	staffKeys,
	staffListQueryOptions,
	staffDetailQueryOptions,
	createStaffFn,
	updateStaffFn,
	deleteStaffFn,
} from "../staff.api";

describe("staff.api", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// --- Query Keys ---

	describe("staffKeys", () => {
		test("should have correct all key", () => {
			expect(staffKeys.all).toEqual(["staff"]);
		});

		test("should have correct list key with params", () => {
			const params = { page: 1, limit: 20 };
			expect(staffKeys.list(params)).toEqual(["staff", "list", params]);
		});

		test("should have correct list key without params", () => {
			expect(staffKeys.list()).toEqual(["staff", "list", undefined]);
		});

		test("should have correct detail key", () => {
			expect(staffKeys.detail(42)).toEqual(["staff", "detail", 42]);
		});

		test("list key should extend all key", () => {
			const listKey = staffKeys.list();
			expect(listKey[0]).toBe(staffKeys.all[0]);
		});

		test("detail key should extend all key", () => {
			const detailKey = staffKeys.detail(1);
			expect(detailKey[0]).toBe(staffKeys.all[0]);
		});
	});

	// --- List Query Options ---

	describe("staffListQueryOptions", () => {
		test("should have correct queryKey", () => {
			const options = staffListQueryOptions();
			expect([...options.queryKey]).toEqual(["staff", "list", undefined]);
		});

		test("should have correct queryKey with params", () => {
			const params = { page: 2, limit: 50, roleId: 1 };
			const options = staffListQueryOptions(params);
			expect([...options.queryKey]).toEqual(["staff", "list", params]);
		});

		test("should have a queryFn defined", () => {
			const options = staffListQueryOptions();
			expect(typeof options.queryFn).toBe("function");
		});

		test("queryFn should call api.api.private.staff.get", async () => {
			const options = staffListQueryOptions();
			await options.queryFn!({} as ListQueryFnContext);
			expect(mockGet).toHaveBeenCalled();
		});

		test("queryFn should pass default params when none provided", async () => {
			const options = staffListQueryOptions();
			await options.queryFn!({} as ListQueryFnContext);
			expect(mockGet).toHaveBeenCalledWith({
				query: { page: 1, limit: 100 },
			});
		});

		test("queryFn should merge custom params over defaults", async () => {
			const options = staffListQueryOptions({
				page: 3,
				limit: 50,
				roleId: 2,
			});
			await options.queryFn!({} as ListQueryFnContext);
			expect(mockGet).toHaveBeenCalledWith({
				query: { page: 3, limit: 50, roleId: 2 },
			});
		});

		test("queryFn should return data.data on success", async () => {
			mockGet.mockResolvedValueOnce({
				data: {
					success: true,
					data: {
						count: 1,
						staff: [{ id: 1, fullname: "Test Staff" }],
					},
				},
				error: null,
			});

			const options = staffListQueryOptions();
			const result = await options.queryFn!({} as ListQueryFnContext);

			expect(result).toEqual({
				count: 1,
				staff: expect.arrayContaining([
					expect.objectContaining({ id: 1, fullname: "Test Staff" }),
				]),
			});
		});

		test("queryFn should throw on error response", async () => {
			mockGet.mockResolvedValueOnce({
				data: null,
				error: { message: "API Error" },
			});

			const options = staffListQueryOptions();
			await expect(
				options.queryFn!({} as ListQueryFnContext),
			).rejects.toEqual({ message: "API Error" });
		});

		test("queryFn should throw on unsuccessful response", async () => {
			mockGet.mockResolvedValueOnce({
				data: { success: false },
				error: null,
			});

			const options = staffListQueryOptions();
			await expect(
				options.queryFn!({} as ListQueryFnContext),
			).rejects.toThrow("Request failed");
		});
	});

	// --- Detail Query Options ---

	describe("staffDetailQueryOptions", () => {
		test("should have correct queryKey", () => {
			const options = staffDetailQueryOptions(42);
			expect([...options.queryKey]).toEqual(["staff", "detail", 42]);
		});

		test("should have a queryFn defined", () => {
			const options = staffDetailQueryOptions(1);
			expect(typeof options.queryFn).toBe("function");
		});

		test("should have enabled=false when id <= 0", () => {
			expect(staffDetailQueryOptions(0).enabled).toBe(false);
			expect(staffDetailQueryOptions(-1).enabled).toBe(false);
		});

		test("should have enabled=true when id > 0", () => {
			expect(staffDetailQueryOptions(1).enabled).toBe(true);
		});

		test("queryFn should call api.api.private.staff({id}).get", async () => {
			const options = staffDetailQueryOptions(1);
			await options.queryFn!({} as DetailQueryFnContext);
			expect(mockGetById).toHaveBeenCalled();
		});

		test("queryFn should return data.data on success", async () => {
			mockGetById.mockResolvedValueOnce({
				data: {
					success: true,
					data: { id: 42, fullname: "Staff Detail" },
				},
				error: null,
			});

			const options = staffDetailQueryOptions(42);
			const result = await options.queryFn!({} as DetailQueryFnContext);

			expect(result).toEqual(
				expect.objectContaining({ id: 42, fullname: "Staff Detail" }),
			);
		});

		test("queryFn should throw on error response", async () => {
			mockGetById.mockResolvedValueOnce({
				data: null,
				error: { message: "Not found" },
			});

			const options = staffDetailQueryOptions(999);
			await expect(
				options.queryFn!({} as DetailQueryFnContext),
			).rejects.toEqual({ message: "Not found" });
		});
	});

	// --- Mutation Functions ---

	describe("createStaffFn", () => {
		test("should call api.api.private.staff.post", async () => {
			await createStaffFn({
				fullname: "New Staff",
				username: "newstaff",
				password: "secret",
				roleId: 1,
			});

			expect(mockPost).toHaveBeenCalled();
		});

		test("should pass correct body with telegramId as empty string when not provided", async () => {
			await createStaffFn({
				fullname: "New Staff",
				username: "newstaff",
				password: "secret",
				roleId: 1,
			});

			expect(mockPost).toHaveBeenCalledWith({
				fullname: "New Staff",
				username: "newstaff",
				password: "secret",
				roleId: 1,
				telegramId: "",
			});
		});

		test("should pass correct body with telegramId when provided", async () => {
			await createStaffFn({
				fullname: "New Staff",
				username: "newstaff",
				password: "secret",
				roleId: 1,
				telegramId: "@telegram",
			});

			expect(mockPost).toHaveBeenCalledWith({
				fullname: "New Staff",
				username: "newstaff",
				password: "secret",
				roleId: 1,
				telegramId: "@telegram",
			});
		});

		test("should return data.data on success", async () => {
			mockPost.mockResolvedValueOnce({
				data: {
					success: true,
					data: { id: 100, fullname: "Created Staff" },
				},
				error: null,
			});

			const result = await createStaffFn({
				fullname: "New Staff",
				username: "newstaff",
				password: "secret",
				roleId: 1,
			});

			expect(result).toEqual(
				expect.objectContaining({ id: 100, fullname: "Created Staff" }),
			);
		});

		test("should throw on error response", async () => {
			mockPost.mockResolvedValueOnce({
				data: null,
				error: { message: "Duplicate username" },
			});

			await expect(
				createStaffFn({
					fullname: "New Staff",
					username: "duplicate",
					password: "secret",
					roleId: 1,
				}),
			).rejects.toEqual({ message: "Duplicate username" });
		});
	});

	describe("updateStaffFn", () => {
		test("should call api.api.private.staff({id}).patch", async () => {
			await updateStaffFn({ id: 1, fullname: "Updated Name" });
			expect(mockPatch).toHaveBeenCalled();
		});

		test("should pass only provided fields", async () => {
			await updateStaffFn({ id: 1, fullname: "Updated Name" });

			expect(mockPatch).toHaveBeenCalledWith({
				fullname: "Updated Name",
			});
		});

		test("should pass multiple fields when provided", async () => {
			await updateStaffFn({
				id: 1,
				fullname: "Updated Name",
				username: "newusername",
				roleId: 2,
			});

			expect(mockPatch).toHaveBeenCalledWith({
				fullname: "Updated Name",
				username: "newusername",
				roleId: 2,
			});
		});

		test("should include telegramId when provided", async () => {
			await updateStaffFn({
				id: 1,
				telegramId: "@newtelegram",
			});

			expect(mockPatch).toHaveBeenCalledWith({
				telegramId: "@newtelegram",
			});
		});

		test("should return data.data on success", async () => {
			mockPatch.mockResolvedValueOnce({
				data: {
					success: true,
					data: { id: 1, fullname: "Updated Staff" },
				},
				error: null,
			});

			const result = await updateStaffFn({
				id: 1,
				fullname: "Updated Staff",
			});

			expect(result).toEqual(
				expect.objectContaining({ id: 1, fullname: "Updated Staff" }),
			);
		});

		test("should throw on error response", async () => {
			mockPatch.mockResolvedValueOnce({
				data: null,
				error: { message: "Permission denied" },
			});

			await expect(
				updateStaffFn({ id: 1, fullname: "Fail" }),
			).rejects.toEqual({ message: "Permission denied" });
		});
	});

	describe("deleteStaffFn", () => {
		test("should call api.api.private.staff({id}).delete", async () => {
			await deleteStaffFn(1);
			expect(mockDelete).toHaveBeenCalled();
		});

		test("should return data.data on success", async () => {
			mockDelete.mockResolvedValueOnce({
				data: {
					success: true,
					data: { id: 1, deletedAt: "2026-01-01" },
				},
				error: null,
			});

			const result = await deleteStaffFn(1);
			expect(result).toEqual({ id: 1, deletedAt: "2026-01-01" });
		});

		test("should throw on error response", async () => {
			mockDelete.mockResolvedValueOnce({
				data: null,
				error: { message: "Cannot delete self" },
			});

			await expect(deleteStaffFn(1)).rejects.toEqual({
				message: "Cannot delete self",
			});
		});
	});
});
