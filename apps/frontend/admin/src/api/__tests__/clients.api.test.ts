import { describe, test, expect, beforeEach, vi } from "vitest";
import type { QueryFunctionContext } from "@tanstack/react-query";

interface MockEdenResponse {
	data: Record<string, unknown> | null;
	error: Record<string, unknown> | null;
}

const { mockGet, mockGetById, mockPost, mockPut, mockDelete, mockRestorePost } = vi.hoisted(() => ({
	mockGet: vi.fn(
		(): Promise<MockEdenResponse> =>
			Promise.resolve({
				data: { success: true, data: { count: 0, users: [] } },
				error: null,
			}),
	),
	mockGetById: vi.fn(
		(): Promise<MockEdenResponse> =>
			Promise.resolve({
				data: { success: true, data: { id: 1, fullname: "Test" } },
				error: null,
			}),
	),
	mockPost: vi.fn(
		(): Promise<MockEdenResponse> =>
			Promise.resolve({
				data: { success: true, data: { id: 1, fullname: "New Client" } },
				error: null,
			}),
	),
	mockPut: vi.fn(
		(): Promise<MockEdenResponse> =>
			Promise.resolve({
				data: { success: true, data: { id: 1, fullname: "Updated" } },
				error: null,
			}),
	),
	mockDelete: vi.fn(
		(): Promise<MockEdenResponse> =>
			Promise.resolve({
				data: { success: true, data: { id: 1 } },
				error: null,
			}),
	),
	mockRestorePost: vi.fn(
		(): Promise<MockEdenResponse> =>
			Promise.resolve({
				data: { success: true, data: { id: 1, deletedAt: null } },
				error: null,
			}),
	),
}));

vi.mock("@/api/client", () => ({
	api: {
		api: {
			private: {
				users: Object.assign(
					(_params: { id: number }) => ({
						get: mockGetById,
						put: mockPut,
						delete: mockDelete,
						restore: { post: mockRestorePost },
					}),
					{
						get: mockGet,
						post: mockPost,
					},
				),
			},
		},
	},
}));

import {
	clientKeys,
	clientsListQueryOptions,
	clientDetailQueryOptions,
	createClientFn,
	updateClientFn,
	deleteClientFn,
	restoreClientFn,
} from "../clients.api";

type ListCtx = QueryFunctionContext<
	readonly ["clients", "list", Record<string, unknown> | undefined]
>;
type DetailCtx = QueryFunctionContext<readonly ["clients", "detail", number]>;

describe("clients.api", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("clientKeys", () => {
		test("should have correct all key", () => {
			expect(clientKeys.all).toEqual(["clients"]);
		});

		test("should have correct list key with params", () => {
			const params = { page: 1, limit: 20 };
			expect(clientKeys.list(params)).toEqual(["clients", "list", params]);
		});

		test("should have correct list key without params", () => {
			expect(clientKeys.list()).toEqual(["clients", "list", undefined]);
		});

		test("should have correct detail key", () => {
			expect(clientKeys.detail(5)).toEqual(["clients", "detail", 5]);
		});

		test("list key should extend all key", () => {
			expect(clientKeys.list()[0]).toBe(clientKeys.all[0]);
		});
	});

	describe("clientsListQueryOptions", () => {
		test("should have correct queryKey", () => {
			const options = clientsListQueryOptions();
			expect([...options.queryKey]).toEqual(["clients", "list", undefined]);
		});

		test("queryFn should call api with defaults", async () => {
			const options = clientsListQueryOptions();
			await options.queryFn!({} as ListCtx);
			expect(mockGet).toHaveBeenCalledWith({
				query: {
					page: 1,
					limit: 20,
					searchQuery: "",
					includeDeleted: false,
				},
			});
		});

		test("queryFn should merge custom params", async () => {
			const options = clientsListQueryOptions({
				limit: 100,
				includeDeleted: true,
			});
			await options.queryFn!({} as ListCtx);
			expect(mockGet).toHaveBeenCalledWith({
				query: {
					page: 1,
					limit: 100,
					searchQuery: "",
					includeDeleted: true,
				},
			});
		});

		test("queryFn should return data on success", async () => {
			mockGet.mockResolvedValueOnce({
				data: {
					success: true,
					data: { count: 2, users: [{ id: 1 }, { id: 2 }] },
				},
				error: null,
			});
			const result = await clientsListQueryOptions().queryFn!(
				{} as ListCtx,
			);
			expect(result).toMatchObject({ count: 2 });
		});

		test("queryFn should throw on error", async () => {
			mockGet.mockResolvedValueOnce({
				data: null,
				error: { status: 500 },
			});
			await expect(
				clientsListQueryOptions().queryFn!({} as ListCtx),
			).rejects.toBeDefined();
		});

		test("queryFn should throw when success is false", async () => {
			mockGet.mockResolvedValueOnce({
				data: { success: false },
				error: null,
			});
			await expect(
				clientsListQueryOptions().queryFn!({} as ListCtx),
			).rejects.toThrow("Request failed");
		});
	});

	describe("clientDetailQueryOptions", () => {
		test("should be enabled when id > 0", () => {
			expect(clientDetailQueryOptions(1).enabled).toBe(true);
		});

		test("should be disabled when id is 0", () => {
			expect(clientDetailQueryOptions(0).enabled).toBe(false);
		});

		test("should be disabled when id is negative", () => {
			expect(clientDetailQueryOptions(-1).enabled).toBe(false);
		});

		test("queryFn should return client on success", async () => {
			mockGetById.mockResolvedValueOnce({
				data: { success: true, data: { id: 3, fullname: "Client" } },
				error: null,
			});
			const result = await clientDetailQueryOptions(3).queryFn!(
				{} as DetailCtx,
			);
			expect(result).toMatchObject({ id: 3 });
		});
	});

	describe("createClientFn", () => {
		test("should call api with body", async () => {
			const body = {
				fullname: "New",
				username: "new_user",
				phone: null,
				telegramId: null,
				photo: null,
				language: "uz" as const,
			};
			await createClientFn(body);
			expect(mockPost).toHaveBeenCalledWith(body);
		});

		test("should throw on error", async () => {
			mockPost.mockResolvedValueOnce({
				data: null,
				error: { status: 400 },
			});
			await expect(
				createClientFn({
					fullname: "",
					username: "",
					phone: null,
					telegramId: null,
					photo: null,
					language: "uz",
				}),
			).rejects.toBeDefined();
		});
	});

	describe("updateClientFn", () => {
		test("should call api with id and body", async () => {
			await updateClientFn({ id: 1, fullname: "Updated" });
			expect(mockPut).toHaveBeenCalledWith({ fullname: "Updated" });
		});

		test("should throw when success is false", async () => {
			mockPut.mockResolvedValueOnce({
				data: { success: false },
				error: null,
			});
			await expect(
				updateClientFn({ id: 1, fullname: "X" }),
			).rejects.toThrow("Request failed");
		});
	});

	describe("deleteClientFn", () => {
		test("should call delete endpoint", async () => {
			await deleteClientFn(5);
			expect(mockDelete).toHaveBeenCalled();
		});
	});

	describe("restoreClientFn", () => {
		test("should call restore endpoint", async () => {
			await restoreClientFn(5);
			expect(mockRestorePost).toHaveBeenCalled();
		});

		test("should throw on error", async () => {
			mockRestorePost.mockResolvedValueOnce({
				data: null,
				error: { status: 404 },
			});
			await expect(restoreClientFn(999)).rejects.toBeDefined();
		});
	});
});
