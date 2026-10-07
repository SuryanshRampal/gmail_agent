import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { decodeConversationLog, insertConversationLog } from "@/lib/conversation-logs";
import { requireUserId } from "@/lib/session";
import { getCached, setCached } from "@/lib/redis-cache";

const contentSchema = z.union([z.string().trim().min(1).max(100000), z.record(z.string(), z.unknown())]);
const startSchema = z.object({ content: contentSchema });

export async function GET() {
  try {
    const userId = await requireUserId();
    const cacheKey = `conversations:list:v3:${userId}`;
    const cached = await getCached<{ conversations: unknown[] }>(cacheKey);
    if (cached) return NextResponse.json(cached);
    const result = await db.query(`
      select "SessionID" as "sessionId", "Logs" as "legacyLog", "EncryptedLogs" as "encryptedLog", created_at as "createdAt"
      from logs.conversation_events
      where "UserID" = $1
      order by created_at asc, "UUID" asc
    `, [userId]);
    const summaries = new Map<string, { sessionId: string; eventCount: number; title: string; sender?: string; recipients?: string; subject?: string; snippet?: string; messageId?: string; createdAt: unknown; updatedAt: unknown }>();
    for (const row of result.rows) {
      const existing = summaries.get(row.sessionId);
      const log = decodeConversationLog(row.encryptedLog, row.legacyLog);
      const content = log && typeof log === "object" && "type" in log && log.type === "user" && "message" in log && log.message && typeof log.message === "object" && "content" in log.message ? log.message.content : "";
      const record = content && typeof content === "object" ? content as Record<string, unknown> : undefined;
      const legacyTitle = typeof content === "string" ? content.replace(/^Requested access assessment for email [^:]+: /, "Opened email: ").slice(0, 72).trim() : "";
      const title = typeof record?.subject === "string" ? record.subject.slice(0, 72) : legacyTitle || "Untitled conversation";
      if (!existing) {
        summaries.set(row.sessionId, { sessionId: row.sessionId, eventCount: 1, title, sender: typeof record?.sender === "string" ? record.sender : undefined, recipients: typeof record?.recipients === "string" ? record.recipients : undefined, subject: typeof record?.subject === "string" ? record.subject : undefined, snippet: typeof record?.snippet === "string" ? record.snippet : undefined, messageId: typeof record?.messageId === "string" ? record.messageId : undefined, createdAt: row.createdAt, updatedAt: row.createdAt });
      } else {
        existing.eventCount += 1;
        existing.updatedAt = row.createdAt;
      }
    }
    const conversations = [...summaries.values()].sort((a, b) => new Date(String(b.updatedAt)).getTime() - new Date(String(a.updatedAt)).getTime());
    const payload = { conversations };
    await setCached(cacheKey, payload, 5 * 60);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    return NextResponse.json({ error: "We couldn't load your conversations." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const input = startSchema.parse(await request.json());
    const sessionId = crypto.randomUUID();
    const uuid = crypto.randomUUID();
    const log = { type: "user" as const, sessionId, uuid, parentUuid: null, message: { role: "user" as const, content: input.content } };
    await insertConversationLog(userId, log);
    return NextResponse.json({ sessionId, event: log }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "A starting message is required." }, { status: 400 });
    return NextResponse.json({ error: "We couldn't start this conversation." }, { status: 503 });
  }
}
