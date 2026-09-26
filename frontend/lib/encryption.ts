import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const USER_DATA_VERSION = "v1";

function encryptionKey(name: "TOKEN_ENCRYPTION_KEY" | "USER_DATA_ENCRYPTION_KEY"): Buffer {
  const encoded = process.env[name];
  if (!encoded) throw new Error(`${name} must be configured.`);
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error(`${name} must be a base64-encoded 32-byte key.`);
  return key;
}

export function encryptToken(value: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey("TOKEN_ENCRYPTION_KEY"), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptToken(payload: string): string {
  const [iv, tag, ciphertext] = payload.split(".");
  if (!iv || !tag || !ciphertext) throw new Error("Invalid encrypted token.");
  const decipher = createDecipheriv(ALGORITHM, encryptionKey("TOKEN_ENCRYPTION_KEY"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function encryptUserData(value: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey("USER_DATA_ENCRYPTION_KEY"), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [USER_DATA_VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptUserData(payload: string): string {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== USER_DATA_VERSION || !iv || !tag || !ciphertext) throw new Error("Invalid encrypted user data.");
  const decipher = createDecipheriv(ALGORITHM, encryptionKey("USER_DATA_ENCRYPTION_KEY"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
