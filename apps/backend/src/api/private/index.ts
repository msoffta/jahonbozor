import { Elysia } from "elysia";
import { users } from "./users/users.index";
import { staff } from "./staff/staff.index";
import { categories } from "./categories/categories.index";
import { products } from "./products/products.index";
import { orders } from "./orders/orders.index";
import { auditLogs } from "./audit-logs/audit-logs.index";

export const privateRoutes = new Elysia({ prefix: "/api/private" })
    .use(users)
    .use(staff)
    .use(categories)
    .use(products)
    .use(orders)
    .use(auditLogs);
