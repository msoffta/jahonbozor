import winston from "winston";

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

export type Logger = winston.Logger;

export const createLogger = (serviceName: string): Logger => {
    return winston.createLogger({
        level: process.env.LOG_LEVEL || "info",
        defaultMeta: { service: serviceName },
        format: process.env.NODE_ENV === "production" ? prodFormat : devFormat,
        transports: [new winston.transports.Console()],
    });
};

export const createChildLogger = (
    parentLogger: Logger,
    context: Record<string, unknown>
): Logger => {
    return parentLogger.child(context);
};
