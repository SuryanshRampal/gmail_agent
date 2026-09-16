import { db } from "@/lib/db";

export type ConversationLog = {
  type: "user" | "assistant";
  sessionId: string;
  uuid: string;
  parentUuid: string | null;
  message: { role: "user" | "assistant"; content: string };
};

export async function insertConversationLog(userId: string, log: ConversationLog): Promise<void> {
  await db.query(
    `insert into logs.conversation_events ("UUID", "SessionID", "UserID", "Logs") values ($1, $2, $3, $4::jsonb)`,
    [log.uuid, log.sessionId, userId, JSON.stringify(log)],
  );
}
