import { Elysia } from "elysia";
import { createChildLogger } from "@jahonbozor/logger";
import baseLogger from "./logger";

const generateRequestId = (): string => {
    return Math.random().toString(36).substring(2, 10);
};

export const requestContext = new Elysia({ name: "requestContext" })
    .derive(({ request, set }) => {
        const incomingRequestId = request.headers.get("x-request-id");
        const requestId = incomingRequestId || generateRequestId();

        const logger = createChildLogger(baseLogger, { requestId });

        set.headers["x-request-id"] = requestId;

        return {
            requestId,
            logger,
        };
    })
    .as("scoped");
