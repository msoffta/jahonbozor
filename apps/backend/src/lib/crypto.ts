import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
    const key = process.env.SESSION_ENCRYPTION_KEY;
    if (key?.length !== 64) {
        throw new Error(
            "SESSION_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32",
        );
    }
    return Buffer.from(key, "hex");
}

/**
 * Encrypt a session string using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (all hex-encoded)
 */
export function encryptSessionString(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt a session string encrypted with encryptSessionString.
 * Input format: iv:authTag:ciphertext (all hex-encoded)
 */
export function decryptSessionString(ciphertext: string): string {
    const key = getEncryptionKey();
    const [ivHex, authTagHex, encrypted] = ciphertext.split(":");

    if (!ivHex || !authTagHex || !encrypted) {
        throw new Error("Invalid encrypted session format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}
