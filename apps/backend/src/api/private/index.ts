import { Elysia } from "elysia";

import { analytics } from "./analytics/analytics.index";
import { auditLogs } from "./audit-logs/audit-logs.index";
import { categories } from "./categories/categories.index";
import { expenses } from "./expenses/expenses.index";
import { orders } from "./orders/orders.index";
import { products } from "./products/products.index";
import { staff } from "./staff/staff.index";
import { users } from "./users/users.index";

export const privateRoutes = new Elysia({ prefix: "/api/private" })
    .use(users)
    .use(staff)
    .use(categories)
    .use(products)
    .use(orders)
    .use(expenses)
    .use(auditLogs)
    .use(analytics);
