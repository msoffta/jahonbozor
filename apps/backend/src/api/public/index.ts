import { Elysia } from "elysia";
import { auth } from "./auth/auth.index";
import { publicProducts } from "./products/products.index";
import { publicOrders } from "./orders/orders.index";

export const publicRoutes = new Elysia({ prefix: "/public" })
    .use(auth)
    .use(publicProducts)
    .use(publicOrders);
