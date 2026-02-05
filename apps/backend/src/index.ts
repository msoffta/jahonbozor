import "dotenv/config";

import { Elysia } from "elysia";
import { sentry } from "elysiajs-sentry";
import cors from "@elysiajs/cors";
import openapi from "@elysiajs/openapi";
import staticPlugin from "@elysiajs/static";

import { publicRoutes } from "./api/public";
import { privateRoutes } from "./api/private";

const app = new Elysia()
    .use(sentry())
    .use(cors())
    .use(openapi())
    .use(staticPlugin())
    .use(publicRoutes.prefix("/api"))
    .use(privateRoutes.prefix("/api"))
    .listen(3000);
