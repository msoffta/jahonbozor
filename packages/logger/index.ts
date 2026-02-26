import winston from "winston";
import Transport from "winston-transport";
import * as Sentry from "@sentry/bun";

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const devFormat = combine(
    colorize(),
    timestamp({ format: "HH:mm:ss" }),
    errors({ stack: true }),
    printf(({ level, message, timestamp, service, requestId, stack, ...meta }) => {
        const stackTrace = stack ? `\n${stack}` : "";
        const metaString = Object.keys(meta).length ? JSON.stringify(meta) : "";
        const requestIdPart = requestId ? ` [${requestId}]` : "";

        return `${timestamp} [${service}]${requestIdPart} ${level}: ${message} ${metaString}${stackTrace}`;
    }),
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

class SentryTransport extends Transport {
    override log(info: { level: string; message: string; [key: string]: unknown }, callback: () => void) {
        setImmediate(() => this.emit("logged", info));

        const { level, message, stack, requestId, service, ...extra } = info;

        if (level === "error") {
            if (stack) {
                const err = new Error(message as string);
                err.stack = stack as string;
                Sentry.captureException(err, {
                    tags: { service: service as string, requestId: requestId as string },
                    extra,
                });
            } else {
                Sentry.captureMessage(message as string, {
                    level: "error",
                    tags: { service: service as string, requestId: requestId as string },
                    extra,
                });
            }
        } else if (level === "warn") {
            Sentry.addBreadcrumb({
                category: service as string,
                message: message as string,
                level: "warning",
                data: extra,
            });
        }

        callback();
    }
}

export type Logger = winston.Logger;

export const createLogger = (serviceName: string): Logger => {
    const transports: winston.transport[] = [new winston.transports.Console()];

    if (process.env.SENTRY_DSN) {
        transports.push(new SentryTransport({ level: "warn" }));
    }

    return winston.createLogger({
        level: process.env.LOG_LEVEL || "info",
        defaultMeta: { service: serviceName },
        format: process.env.NODE_ENV === "production" ? prodFormat : devFormat,
        transports,
    });
};

export const createChildLogger = (
    parentLogger: Logger,
    context: Record<string, unknown>
): Logger => {
    return parentLogger.child(context);
};
