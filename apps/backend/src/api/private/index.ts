import { Elysia } from "elysia";

import { analytics } from "./analytics/analytics.index";
import { auditLogs } from "./audit-logs/audit-logs.index";
import { broadcastTemplates } from "./broadcast-templates/broadcast-templates.index";
import { broadcasts } from "./broadcasts/broadcasts.index";
import { categories } from "./categories/categories.index";
import { debts } from "./debts/debts.index";
import { expenses } from "./expenses/expenses.index";
import { orders } from "./orders/orders.index";
import { products } from "./products/products.index";
import { staff } from "./staff/staff.index";
import { telegramSessions } from "./telegram-sessions/telegram-sessions.index";
import { users } from "./users/users.index";

export const privateRoutes = new Elysia({ prefix: "/api/private" })
    .use(users)
    .use(staff)
    .use(categories)
    .use(products)
    .use(orders)
    .use(expenses)
    .use(debts)
    .use(auditLogs)
    .use(analytics)
    .use(broadcastTemplates)
    .use(broadcasts)
    .use(telegramSessions);
