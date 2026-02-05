import { Elysia } from "elysia";
import { users } from "./users/users.index";
import { staff } from "./staff/staff.index";
import { categories } from "./categories/categories.index";
import { subcategories } from "./subcategories/subcategories.index";
import { products } from "./products/products.index";
import { productHistory } from "./product-history/product-history.index";
import { orders } from "./orders/orders.index";

export const privateRoutes = new Elysia({ prefix: "/private" })
    .use(users)
    .use(staff)
    .use(categories)
    .use(subcategories)
    .use(products)
    .use(productHistory)
    .use(orders);
