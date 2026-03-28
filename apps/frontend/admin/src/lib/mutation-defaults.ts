/**
 * Register mutation defaults on the query client.
 * This is required for offline mutation persistence:
 * mutationFn cannot be serialized, so after page reload
 * the query client needs to know which function to call
 * for each mutation key.
 */
import { createCategoryFn } from "@/api/categories.api";
import { createClientFn, deleteClientFn, restoreClientFn, updateClientFn } from "@/api/clients.api";
import { createDebtPaymentFn } from "@/api/debts.api";
import {
    createExpenseFn,
    deleteExpenseFn,
    restoreExpenseFn,
    updateExpenseFn,
} from "@/api/expenses.api";
import { createIncomeFn } from "@/api/income.api";
import { createOrderFn, deleteOrderFn, updateOrderFn } from "@/api/orders.api";
import {
    createProductFn,
    deleteProductFn,
    importProductsFn,
    restoreProductFn,
    updateProductFn,
} from "@/api/products.api";
import { createRoleFn, deleteRoleFn, updateRoleFn } from "@/api/roles.api";
import { createStaffFn, deleteStaffFn, updateStaffFn } from "@/api/staff.api";

import type { QueryClient } from "@tanstack/react-query";

export function registerMutationDefaults(queryClient: QueryClient) {
    // Orders
    queryClient.setMutationDefaults(["orders", "create"], { mutationFn: createOrderFn });
    queryClient.setMutationDefaults(["orders", "update"], { mutationFn: updateOrderFn });
    queryClient.setMutationDefaults(["orders", "delete"], { mutationFn: deleteOrderFn });

    // Clients
    queryClient.setMutationDefaults(["clients", "create"], { mutationFn: createClientFn });
    queryClient.setMutationDefaults(["clients", "update"], { mutationFn: updateClientFn });
    queryClient.setMutationDefaults(["clients", "delete"], { mutationFn: deleteClientFn });
    queryClient.setMutationDefaults(["clients", "restore"], { mutationFn: restoreClientFn });

    // Products
    queryClient.setMutationDefaults(["products", "create"], { mutationFn: createProductFn });
    queryClient.setMutationDefaults(["products", "update"], { mutationFn: updateProductFn });
    queryClient.setMutationDefaults(["products", "delete"], { mutationFn: deleteProductFn });
    queryClient.setMutationDefaults(["products", "restore"], { mutationFn: restoreProductFn });
    queryClient.setMutationDefaults(["products", "import"], { mutationFn: importProductsFn });

    // Expenses
    queryClient.setMutationDefaults(["expenses", "create"], { mutationFn: createExpenseFn });
    queryClient.setMutationDefaults(["expenses", "update"], { mutationFn: updateExpenseFn });
    queryClient.setMutationDefaults(["expenses", "delete"], { mutationFn: deleteExpenseFn });
    queryClient.setMutationDefaults(["expenses", "restore"], { mutationFn: restoreExpenseFn });

    // Income
    queryClient.setMutationDefaults(["income", "create"], { mutationFn: createIncomeFn });

    // Debts
    queryClient.setMutationDefaults(["debts", "createPayment"], {
        mutationFn: createDebtPaymentFn,
    });

    // Categories
    queryClient.setMutationDefaults(["categories", "create"], { mutationFn: createCategoryFn });

    // Roles
    queryClient.setMutationDefaults(["roles", "create"], { mutationFn: createRoleFn });
    queryClient.setMutationDefaults(["roles", "update"], { mutationFn: updateRoleFn });
    queryClient.setMutationDefaults(["roles", "delete"], { mutationFn: deleteRoleFn });

    // Staff
    queryClient.setMutationDefaults(["staff", "create"], { mutationFn: createStaffFn });
    queryClient.setMutationDefaults(["staff", "update"], { mutationFn: updateStaffFn });
    queryClient.setMutationDefaults(["staff", "delete"], { mutationFn: deleteStaffFn });
}
