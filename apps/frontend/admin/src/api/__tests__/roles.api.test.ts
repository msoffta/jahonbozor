import { describe, test, expect, beforeEach, mock } from "bun:test";
import type { QueryFunctionContext } from "@tanstack/react-query";

interface MockEdenResponse {
	data: Record<string, unknown> | null;
	error: Record<string, unknown> | null;
}

type ListQueryFnContext = QueryFunctionContext<
	readonly ["roles", "list", Record<string, unknown> | undefined]
>;
type DetailQueryFnContext = QueryFunctionContext<
	readonly ["roles", "detail", number]
>;

// --- Mock setup (BEFORE imports) ---

const mockGet = mock(
	(): Promise<MockEdenResponse> =>
		Promise.resolve({
			data: {
				success: true,
				data: {
					count: 2,
					roles: [
						{
							id: 1,
							name: "Admin",
							permissions: ["staff:read:all", "roles:read", "roles:update"],
							createdAt: "2026-01-01",
							_count: { staffs: 5 },
						},
						{
							id: 2,
							name: "Manager",
							permissions: ["staff:read:own"],
							createdAt: "2026-01-02",
							_count: { staffs: 3 },
						},
					],
				},
			},
			error: null,
		}),
);

const mockGetById = mock(
	(): Promise<MockEdenResponse> =>
		Promise.resolve({
			data: {
				success: true,
				data: {
					id: 1,
					name: "Admin",
					permissions: ["staff:read:all", "roles:read"],
					createdAt: "2026-01-01",
				},
			},
			error: null,
		}),
);

const mockPost = mock(
	(): Promise<MockEdenResponse> =>
		Promise.resolve({
			data: {
				success: true,
				data: {
					id: 3,
					name: "New Role",
					permissions: ["staff:read:own"],
					createdAt: "2026-01-03",
				},
			},
			error: null,
		}),
);

const mockPatch = mock(
	(): Promise<MockEdenResponse> =>
		Promise.resolve({
			data: {
				success: true,
				data: {
					id: 1,
					name: "Updated Role",
					permissions: ["staff:read:all"],
				},
			},
			error: null,
		}),
);

const mockDelete = mock(
	(): Promise<MockEdenResponse> =>
		Promise.resolve({
			data: {
				success: true,
				data: { id: 1, name: "Admin", deletedAt: "2026-01-01" },
			},
			error: null,
		}),
);

mock.module("@/api/client", () => ({
	api: {
		api: {
			private: {
				staff: {
					roles: Object.assign(
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
	},
}));

// --- Imports AFTER mocks ---
import {
	roleKeys,
	rolesListQueryOptions,
	roleDetailQueryOptions,
	createRoleFn,
	updateRoleFn,
	deleteRoleFn,
} from "../roles.api";

describe("roles.api", () => {
	beforeEach(() => {
		mock.restore();
	});

	// --- Query Keys ---

	describe("roleKeys", () => {
		test("should have correct all key", () => {
			expect(roleKeys.all).toEqual(["roles"]);
		});

		test("should have correct list key with params", () => {
			const params = { page: 1, limit: 20 };
			expect(roleKeys.list(params)).toEqual(["roles", "list", params]);
		});

		test("should have correct list key without params", () => {
			expect(roleKeys.list()).toEqual(["roles", "list", undefined]);
		});

		test("should have correct detail key", () => {
			expect(roleKeys.detail(42)).toEqual(["roles", "detail", 42]);
		});

		test("list key should extend all key", () => {
			const listKey = roleKeys.list();
			expect(listKey[0]).toBe(roleKeys.all[0]);
		});

		test("detail key should extend all key", () => {
			const detailKey = roleKeys.detail(1);
			expect(detailKey[0]).toBe(roleKeys.all[0]);
		});
	});

	// --- List Query Options ---

	describe("rolesListQueryOptions", () => {
		test("should have correct queryKey", () => {
			const options = rolesListQueryOptions();
			expect([...options.queryKey]).toEqual(["roles", "list", undefined]);
		});

		test("should have correct queryKey with params", () => {
			const params = { page: 2, limit: 50, includeStaffCount: true };
			const options = rolesListQueryOptions(params);
			expect([...options.queryKey]).toEqual(["roles", "list", params]);
		});

		test("should have a queryFn defined", () => {
			const options = rolesListQueryOptions();
			expect(typeof options.queryFn).toBe("function");
		});

		test("queryFn should call api.api.private.staff.roles.get", async () => {
			const options = rolesListQueryOptions();
			await options.queryFn!({} as ListQueryFnContext);
			expect(mockGet).toHaveBeenCalled();
		});

		test("queryFn should pass default params when none provided", async () => {
			const options = rolesListQueryOptions();
			await options.queryFn!({} as ListQueryFnContext);
			expect(mockGet).toHaveBeenCalledWith({
				query: { page: 1, limit: 100, includeStaffCount: true },
			});
		});

		test("queryFn should merge custom params over defaults", async () => {
			const options = rolesListQueryOptions({
				page: 3,
				limit: 50,
				searchQuery: "admin",
			});
			await options.queryFn!({} as ListQueryFnContext);
			expect(mockGet).toHaveBeenCalledWith({
				query: {
					page: 3,
					limit: 50,
					includeStaffCount: true,
					searchQuery: "admin",
				},
			});
		});

		test("queryFn should return data.data on success", async () => {
			mockGet.mockResolvedValueOnce({
				data: {
					success: true,
					data: {
						count: 1,
						roles: [{ id: 1, name: "Test Role" }],
					},
				},
				error: null,
			});

			const options = rolesListQueryOptions();
			const result = await options.queryFn!({} as ListQueryFnContext);

			expect(result).toEqual({
				count: 1,
				roles: expect.arrayContaining([
					expect.objectContaining({ id: 1, name: "Test Role" }),
				]),
			});
		});

		test("queryFn should throw on error response", async () => {
			mockGet.mockResolvedValueOnce({
				data: null,
				error: { message: "API Error" },
			});

			const options = rolesListQueryOptions();
			await expect(
				options.queryFn!({} as ListQueryFnContext),
			).rejects.toEqual({ message: "API Error" });
		});

		test("queryFn should throw on unsuccessful response", async () => {
			mockGet.mockResolvedValueOnce({
				data: { success: false },
				error: null,
			});

			const options = rolesListQueryOptions();
			await expect(
				options.queryFn!({} as ListQueryFnContext),
			).rejects.toThrow("Request failed");
		});
	});

	// --- Detail Query Options ---

	describe("roleDetailQueryOptions", () => {
		test("should have correct queryKey", () => {
			const options = roleDetailQueryOptions(42);
			expect([...options.queryKey]).toEqual(["roles", "detail", 42]);
		});

		test("should have a queryFn defined", () => {
			const options = roleDetailQueryOptions(1);
			expect(typeof options.queryFn).toBe("function");
		});

		test("should have enabled=false when id <= 0", () => {
			expect(roleDetailQueryOptions(0).enabled).toBe(false);
			expect(roleDetailQueryOptions(-1).enabled).toBe(false);
		});

		test("should have enabled=true when id > 0", () => {
			expect(roleDetailQueryOptions(1).enabled).toBe(true);
		});

		test("queryFn should call api.api.private.staff.roles({id}).get", async () => {
			const options = roleDetailQueryOptions(1);
			await options.queryFn!({} as DetailQueryFnContext);
			expect(mockGetById).toHaveBeenCalled();
		});

		test("queryFn should return data.data on success", async () => {
			mockGetById.mockResolvedValueOnce({
				data: {
					success: true,
					data: { id: 42, name: "Role Detail" },
				},
				error: null,
			});

			const options = roleDetailQueryOptions(42);
			const result = await options.queryFn!({} as DetailQueryFnContext);

			expect(result).toEqual(
				expect.objectContaining({ id: 42, name: "Role Detail" }),
			);
		});

		test("queryFn should throw on error response", async () => {
			mockGetById.mockResolvedValueOnce({
				data: null,
				error: { message: "Not found" },
			});

			const options = roleDetailQueryOptions(999);
			await expect(
				options.queryFn!({} as DetailQueryFnContext),
			).rejects.toEqual({ message: "Not found" });
		});
	});

	// --- Mutation Functions ---

	describe("createRoleFn", () => {
		test("should call api.api.private.staff.roles.post", async () => {
			await createRoleFn({
				name: "New Role",
				permissions: ["staff:read:own"],
			});

			expect(mockPost).toHaveBeenCalled();
		});

		test("should pass correct body with permissions array", async () => {
			await createRoleFn({
				name: "New Role",
				permissions: ["staff:read:own", "roles:read"],
			});

			expect(mockPost).toHaveBeenCalledWith({
				name: "New Role",
				permissions: ["staff:read:own", "roles:read"],
			});
		});

		test("should handle empty permissions array", async () => {
			await createRoleFn({
				name: "Empty Role",
				permissions: [],
			});

			expect(mockPost).toHaveBeenCalledWith({
				name: "Empty Role",
				permissions: [],
			});
		});

		test("should return data.data on success", async () => {
			mockPost.mockResolvedValueOnce({
				data: {
					success: true,
					data: { id: 100, name: "Created Role", permissions: [] },
				},
				error: null,
			});

			const result = await createRoleFn({
				name: "New Role",
				permissions: [],
			});

			expect(result).toEqual(
				expect.objectContaining({
					id: 100,
					name: "Created Role",
					permissions: [],
				}),
			);
		});

		test("should throw on error response", async () => {
			mockPost.mockResolvedValueOnce({
				data: null,
				error: { message: "Duplicate role name" },
			});

			await expect(
				createRoleFn({
					name: "Duplicate",
					permissions: [],
				}),
			).rejects.toEqual({ message: "Duplicate role name" });
		});
	});

	describe("updateRoleFn", () => {
		test("should call api.api.private.staff.roles({id}).patch", async () => {
			await updateRoleFn({ id: 1, name: "Updated Role" });
			expect(mockPatch).toHaveBeenCalled();
		});

		test("should pass only name when only name is provided", async () => {
			await updateRoleFn({ id: 1, name: "Updated Role" });

			expect(mockPatch).toHaveBeenCalledWith({
				name: "Updated Role",
			});
		});

		test("should pass only permissions when only permissions are provided", async () => {
			await updateRoleFn({
				id: 1,
				permissions: ["staff:read:all", "roles:read"],
			});

			expect(mockPatch).toHaveBeenCalledWith({
				permissions: ["staff:read:all", "roles:read"],
			});
		});

		test("should pass both name and permissions when both are provided", async () => {
			await updateRoleFn({
				id: 1,
				name: "Updated Role",
				permissions: ["staff:read:all"],
			});

			expect(mockPatch).toHaveBeenCalledWith({
				name: "Updated Role",
				permissions: ["staff:read:all"],
			});
		});

		test("should handle empty permissions array update", async () => {
			await updateRoleFn({
				id: 1,
				permissions: [],
			});

			expect(mockPatch).toHaveBeenCalledWith({
				permissions: [],
			});
		});

		test("should return data.data on success", async () => {
			mockPatch.mockResolvedValueOnce({
				data: {
					success: true,
					data: { id: 1, name: "Updated Role" },
				},
				error: null,
			});

			const result = await updateRoleFn({
				id: 1,
				name: "Updated Role",
			});

			expect(result).toEqual(
				expect.objectContaining({ id: 1, name: "Updated Role" }),
			);
		});

		test("should throw on error response", async () => {
			mockPatch.mockResolvedValueOnce({
				data: null,
				error: { message: "Permission denied" },
			});

			await expect(
				updateRoleFn({ id: 1, name: "Fail" }),
			).rejects.toEqual({ message: "Permission denied" });
		});
	});

	describe("deleteRoleFn", () => {
		test("should call api.api.private.staff.roles({id}).delete", async () => {
			await deleteRoleFn(1);
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

			const result = await deleteRoleFn(1);
			expect(result).toEqual({ id: 1, deletedAt: "2026-01-01" });
		});

		test("should throw on error response", async () => {
			mockDelete.mockResolvedValueOnce({
				data: null,
				error: { message: "Cannot delete role with staff members" },
			});

			await expect(deleteRoleFn(1)).rejects.toEqual({
				message: "Cannot delete role with staff members",
			});
		});
	});
});
