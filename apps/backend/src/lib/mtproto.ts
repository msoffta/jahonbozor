import bigInt from "big-integer";
import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

import { decryptSessionString } from "./crypto";
import { prisma } from "./prisma";

import type { Logger } from "@jahonbozor/logger";

// Active client pool: sessionId → TelegramClient
const clientPool = new Map<number, TelegramClient>();

// Pending QR login sessions: token → { client, apiId, apiHash, resolve, createdAt }
interface PendingQrLogin {
    client: TelegramClient;
    apiId: number;
    apiHash: string;
    sessionName: string;
    phone: string;
    resolve: ((sessionString: string) => void) | null;
    sessionString: string | null;
    status: "waiting" | "authenticated" | "expired" | "needs_password";
    passwordResolve: ((password: string) => void) | null;
    createdAt: number;
}

const pendingQrLogins = new Map<string, PendingQrLogin>();

// Cleanup expired QR logins every 60s
const QR_EXPIRY_MS = 60_000;
setInterval(() => {
    const now = Date.now();
    for (const [token, pending] of pendingQrLogins) {
        if (now - pending.createdAt > QR_EXPIRY_MS) {
            pending.status = "expired";
            void pending.client.disconnect().catch(() => {
                /* noop */
            });
            pendingQrLogins.delete(token);
        }
    }
}, QR_EXPIRY_MS);

/**
 * Get an active TelegramClient for a session. Connects lazily if needed.
 */
export async function getClient(sessionId: number, logger: Logger): Promise<TelegramClient> {
    const existing = clientPool.get(sessionId);
    if (existing?.connected) {
        return existing;
    }

    return connectClient(sessionId, logger);
}

/**
 * Connect (or reconnect) a TelegramClient for a stored session.
 */
export async function connectClient(sessionId: number, logger: Logger): Promise<TelegramClient> {
    const session = await prisma.telegramSession.findUnique({ where: { id: sessionId } });
    if (!session) {
        throw new Error(`Telegram session ${sessionId} not found`);
    }

    if (session.deletedAt) {
        throw new Error(`Telegram session ${sessionId} is deleted`);
    }

    const sessionString = decryptSessionString(session.sessionString);
    const client = new TelegramClient(
        new StringSession(sessionString),
        session.apiId,
        session.apiHash,
        { connectionRetries: 3 },
    );

    await client.connect();

    // Verify the session is still valid
    try {
        await client.getMe();
    } catch {
        await prisma.telegramSession.update({
            where: { id: sessionId },
            data: { status: "DISCONNECTED" },
        });
        clientPool.delete(sessionId);
        throw new Error(`Telegram session ${sessionId} is no longer valid`);
    }

    clientPool.set(sessionId, client);

    await prisma.telegramSession.update({
        where: { id: sessionId },
        data: { status: "ACTIVE", lastUsedAt: new Date() },
    });

    logger.info("MTProto: Client connected", { sessionId });
    return client;
}

/**
 * Disconnect a TelegramClient.
 */
export async function disconnectClient(sessionId: number, logger: Logger): Promise<void> {
    const client = clientPool.get(sessionId);
    if (client) {
        await client.disconnect();
        clientPool.delete(sessionId);
        logger.info("MTProto: Client disconnected", { sessionId });
    }
}

/**
 * Start QR login flow. Returns a QR URL and an opaque token for polling.
 */
export async function initQrLogin(
    params: { name: string; phone: string; apiId?: number; apiHash?: string },
    logger: Logger,
): Promise<{ qrUrl: string; token: string }> {
    const apiId = params.apiId ?? Number(process.env.TELEGRAM_API_ID);
    const apiHash = params.apiHash ?? process.env.TELEGRAM_API_HASH ?? "";

    if (!apiId || !apiHash) {
        throw new Error("TELEGRAM_API_ID and TELEGRAM_API_HASH must be configured in .env");
    }

    const { name, phone } = params;
    const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
        connectionRetries: 3,
    });

    await client.connect();

    const token = crypto.randomUUID();

    const pending: PendingQrLogin = {
        client,
        apiId,
        apiHash,
        sessionName: name,
        phone,
        resolve: null,
        sessionString: null,
        status: "waiting",
        passwordResolve: null,
        createdAt: Date.now(),
    };

    pendingQrLogins.set(token, pending);

    // Start QR login in background
    void client
        .signInUserWithQrCode(
            { apiId, apiHash },
            {
                qrCode: async (code) => {
                    await Promise.resolve();
                    const base64Token = Buffer.from(code.token).toString("base64url");
                    pending.status = "waiting";
                    // Store the latest QR URL on the pending object for polling
                    (pending as PendingQrLogin & { latestQrUrl?: string }).latestQrUrl =
                        `tg://login?token=${base64Token}`;
                },
                password: async () => {
                    // 2FA: set status and wait for password from frontend
                    pending.status = "needs_password";
                    logger.info("MTProto: QR login requires 2FA password", { name });
                    return new Promise<string>((resolve) => {
                        pending.passwordResolve = resolve;
                    });
                },
                onError: async (err) => {
                    await Promise.resolve();
                    const errMsg = err instanceof Error ? err.message : String(err);
                    logger.warn("MTProto: QR login onError callback", { error: errMsg });
                    // Return false to keep retrying — DC redirects trigger onError but are normal
                    return false;
                },
            },
        )
        .then(() => {
            // Login succeeded
            const savedSession = client.session.save() as unknown as string;
            pending.sessionString = savedSession;
            pending.status = "authenticated";
            logger.info("MTProto: QR login authenticated", { name, phone });
        })
        .catch((err) => {
            const errMsg = err instanceof Error ? err.message : String(err);
            // TIMEOUT is normal after successful auth — gramjs updates loop expires
            if (errMsg === "TIMEOUT" && pending.status === "authenticated") {
                logger.debug("MTProto: Post-auth timeout (expected)", { name });
                return;
            }
            logger.error("MTProto: QR login failed", { error: errMsg });
            if (pending.status !== "authenticated") {
                pending.status = "expired";
            }
        });

    // Wait briefly for the first QR code to be generated
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const qrUrl =
        (pending as PendingQrLogin & { latestQrUrl?: string }).latestQrUrl ??
        `tg://login?token=${token}`;

    return { qrUrl, token };
}

/**
 * Poll QR login status. Returns the session ID if authenticated.
 */
export async function pollQrStatus(
    token: string,
    logger: Logger,
): Promise<{
    status: "waiting" | "authenticated" | "expired" | "needs_password";
    sessionId?: number;
}> {
    const pending = pendingQrLogins.get(token);
    if (!pending) {
        return { status: "expired" };
    }

    if (pending.status === "needs_password") {
        return { status: "needs_password" };
    }

    if (pending.status === "authenticated" && pending.sessionString) {
        // Save to database
        const { encryptSessionString } = await import("./crypto");
        const encrypted = encryptSessionString(pending.sessionString);

        const session = await prisma.telegramSession.create({
            data: {
                name: pending.sessionName,
                phone: pending.phone,
                apiId: pending.apiId,
                apiHash: pending.apiHash,
                sessionString: encrypted,
                status: "ACTIVE",
                lastUsedAt: new Date(),
            },
        });

        // Add client to pool
        clientPool.set(session.id, pending.client);
        pendingQrLogins.delete(token);

        logger.info("MTProto: Session saved", { sessionId: session.id, name: pending.sessionName });
        return { status: "authenticated", sessionId: session.id };
    }

    if (pending.status === "expired") {
        pendingQrLogins.delete(token);
        return { status: "expired" };
    }

    return { status: "waiting" };
}

/**
 * Submit 2FA password for a pending QR login.
 */
export function submitQrPassword(token: string, password: string): boolean {
    const pending = pendingQrLogins.get(token);
    if (pending?.status !== "needs_password" || !pending.passwordResolve) {
        return false;
    }
    pending.passwordResolve(password);
    pending.passwordResolve = null;
    pending.status = "waiting"; // back to waiting while gramjs processes
    return true;
}

/**
 * Get the latest QR URL for a pending login.
 */
export function getLatestQrUrl(token: string): string | null {
    const pending = pendingQrLogins.get(token);
    if (!pending) return null;
    return (pending as PendingQrLogin & { latestQrUrl?: string }).latestQrUrl ?? null;
}

/**
 * Check if a client is connected.
 */
export function isClientConnected(sessionId: number): boolean {
    const client = clientPool.get(sessionId);
    return !!client?.connected;
}

/**
 * Send a message via MTProto.
 */
export async function sendMessage(
    sessionId: number,
    telegramId: string,
    options: {
        message?: string;
        parseMode?: "html";
        file?: string;
    },
    logger: Logger,
): Promise<void> {
    const client = await getClient(sessionId, logger);

    // Resolve entity — try multiple approaches
    let entity: Api.TypeEntityLike | undefined;

    // 1. Try getEntity (works if user is in session cache / contacts)
    try {
        entity = await client.getEntity(telegramId);
        logger.debug("MTProto: Entity found in cache", { telegramId });
    } catch (err) {
        logger.debug("MTProto: Entity not in cache", {
            telegramId,
            error: err instanceof Error ? err.message : String(err),
        });
    }

    // 2. Try adding as contact by phone number from DB
    if (!entity) {
        const dbUser = await prisma.users.findFirst({
            where: { telegramId, deletedAt: null },
            select: { phone: true, fullname: true },
        });

        logger.debug("MTProto: DB user lookup", {
            telegramId,
            hasPhone: !!dbUser?.phone,
            phone: dbUser?.phone,
        });

        if (dbUser?.phone) {
            try {
                const result = await client.invoke(
                    new Api.contacts.ImportContacts({
                        contacts: [
                            new Api.InputPhoneContact({
                                clientId: bigInt(0),
                                phone: dbUser.phone,
                                firstName: dbUser.fullname || "User",
                                lastName: "",
                            }),
                        ],
                    }),
                );
                logger.debug("MTProto: ImportContacts result", {
                    telegramId,
                    usersCount: result.users.length,
                    importedCount: result.imported.length,
                    retryCount: result.retryContacts.length,
                });
                if (result.users.length > 0) {
                    entity = result.users[0];
                }
            } catch (err) {
                logger.warn("MTProto: Failed to import contact", {
                    telegramId,
                    phone: dbUser.phone,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
    }

    // 3. Try direct InputPeerUser (last resort — may work if user messaged this account before)
    if (!entity) {
        try {
            const inputPeer = new Api.InputPeerUser({
                userId: bigInt(telegramId),
                accessHash: bigInt(0),
            });
            // Test if we can use this peer
            await client.invoke(
                new Api.users.GetUsers({
                    id: [new Api.InputUser({ userId: bigInt(telegramId), accessHash: bigInt(0) })],
                }),
            );
            entity = inputPeer;
            logger.debug("MTProto: Using InputPeerUser fallback", { telegramId });
        } catch (err) {
            logger.debug("MTProto: InputPeerUser fallback failed", {
                telegramId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    if (!entity) {
        throw new Error("Не удалось найти пользователя в Telegram");
    }

    await client.sendMessage(entity, {
        message: options.message ?? "",
        parseMode: options.parseMode ?? "html",
        file: options.file,
    });

    await prisma.telegramSession.update({
        where: { id: sessionId },
        data: { lastUsedAt: new Date() },
    });
}
