import { db } from "@/lib/db";
import { decryptUserData, encryptUserData } from "@/lib/encryption";
import { invalidateConversationCache } from "@/lib/redis-cache";

export type ConversationLog = {
  type: "user" | "assistant";
  sessionId: string;
  uuid: string;
  parentUuid: string | null;
  message: { role: "user" | "assistant"; content: string | Record<string, unknown> };
};

export function decodeConversationLog(encryptedLog: unknown, legacyLog: unknown): unknown {
  if (typeof encryptedLog === "string" && encryptedLog.length > 0) {
    return JSON.parse(decryptUserData(encryptedLog)) as unknown;
  }
  return legacyLog;
}

export async function insertConversationLog(userId: string, log: ConversationLog): Promise<void> {
  await db.query(
    `insert into logs.conversation_events ("UUID", "SessionID", "UserID", "Logs", "EncryptedLogs") values ($1, $2, $3, null, $4)`,
    [log.uuid, log.sessionId, userId, encryptUserData(JSON.stringify(log))],
  );
  await invalidateConversationCache(userId, log.sessionId);
}
