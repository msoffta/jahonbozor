import { Elysia } from "elysia";
import { auth } from "./auth/auth.index";
import { publicProducts } from "./products/products.index";
import { publicOrders } from "./orders/orders.index";
import { publicUsers } from "./users/users.index";

export const publicRoutes = new Elysia({ prefix: "/api/public" })
    .use(auth)
    .use(publicProducts)
    .use(publicOrders)
    .use(publicUsers);
