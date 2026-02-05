import winston from "winston";

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const devFormat = combine(
    colorize(),
    timestamp({ format: "HH:mm:ss" }),
    errors({ stacK: true }),
    printf(({ level, message, timestamp, service, stack, ...meta }) => {
        // Если есть stack (ошибка), выводим его. Если нет — пустота.
        const stackTrace = stack ? `\n${stack}` : "";

        // Если есть дополнительные данные (userId и т.д.), превращаем их в строку
        const metaString = Object.keys(meta).length ? JSON.stringify(meta) : "";

        return `${timestamp} [${service}] ${level}: ${message} ${metaString}${stackTrace}`;
    }),
);

const prodFormat = combine(timestamp(), errors({ stacK: true }), json());

export const createLogger = (serviceName: string): winston.Logger => {
    return winston.createLogger({
        level: process.env.LOG_LEVEL || "info",
        defaultMeta: { service: serviceName },
        format: process.env.NODE_ENV === "production" ? prodFormat : devFormat,
        transports: [new winston.transports.Console()],
    });
};
