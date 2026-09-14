import { randomUUID } from "crypto";

import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/encryption";

const TTL_MS = 10 * 60 * 1000;

export async function createPreflightNonce(userId: string, messageId: string): Promise<string> {
  await db.query(`create table if not exists message_access_preflights (nonce text primary key, "userId" text not null, message_id text not null, expires_at bigint not null)`);
  const nonce = randomUUID();
  await db.query(`insert into message_access_preflights (nonce, "userId", message_id, expires_at) values ($1, $2, $3, $4)`, [nonce, userId, messageId, Date.now() + TTL_MS]);
  return nonce;
}

export async function issuePermission(userId: string, messageId: string, nonce: string): Promise<string | null> {
  await db.query(`create table if not exists message_access_preflights (nonce text primary key, "userId" text not null, message_id text not null, expires_at bigint not null)`);
  const result = await db.query<{ nonce: string }>(`delete from message_access_preflights where nonce = $1 and "userId" = $2 and message_id = $3 and expires_at > $4 returning nonce`, [nonce, userId, messageId, Date.now()]);
  if (!result.rowCount) return null;
  return encryptToken(JSON.stringify({ userId, messageId, expiresAt: Date.now() + TTL_MS }));
}

export function validatePermission(userId: string, messageId: string, token: string | null): boolean {
  if (!token) return false;
  try {
    const value = JSON.parse(decryptToken(token)) as { userId?: string; messageId?: string; expiresAt?: number };
    return value.userId === userId && value.messageId === messageId && Boolean(value.expiresAt && value.expiresAt > Date.now());
  } catch { return false; }
}
