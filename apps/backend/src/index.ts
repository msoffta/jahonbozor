import "dotenv/config";

import { Elysia } from "elysia";
import { sentry } from "elysiajs-sentry";
import cors from "@elysiajs/cors";
import openapi from "@elysiajs/openapi";
import staticPlugin from "@elysiajs/static";

import { requestContext } from "./lib/request-context";
import { publicRoutes } from "./api/public";
import { privateRoutes } from "./api/private";

const app = new Elysia()
    .use(sentry())
    .use(cors())
    .use(requestContext)
    .use(openapi())
    .use(staticPlugin())
    .use(publicRoutes)
    .use(privateRoutes)
    .listen(3000);

export type App = typeof app;
