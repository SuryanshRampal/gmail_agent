import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { insertConversationLog } from "@/lib/conversation-logs";
import { requireUserId } from "@/lib/session";

const contentSchema = z.union([z.string().trim().min(1).max(100000), z.record(z.string(), z.unknown())]);
const continueSchema = z.object({ content: contentSchema });

async function getSessionId(params: Promise<{ sessionId: string }>): Promise<string> {
  const sessionId = (await params).sessionId;
  if (!z.string().uuid().safeParse(sessionId).success) throw new Error("INVALID_SESSION_ID");
  return sessionId;
}

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const userId = await requireUserId();
    const sessionId = await getSessionId(params);
    const result = await db.query(`
      select "UUID" as "uuid", "SessionID" as "sessionId", "Logs" as "log", created_at as "createdAt"
      from logs.conversation_events
      where "UserID" = $1 and "SessionID" = $2
      order by created_at asc, "UUID" asc
    `, [userId, sessionId]);
    if (result.rowCount === 0) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    return NextResponse.json({ sessionId, events: result.rows });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    if (error instanceof Error && error.message === "INVALID_SESSION_ID") return NextResponse.json({ error: "Invalid conversation ID." }, { status: 400 });
    return NextResponse.json({ error: "We couldn't load this conversation." }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const userId = await requireUserId();
    const sessionId = await getSessionId(params);
    const input = continueSchema.parse(await request.json());
    const latest = await db.query<{ uuid: string }>(`
      select "UUID" as uuid
      from logs.conversation_events
      where "UserID" = $1 and "SessionID" = $2
      order by created_at desc, "UUID" desc
      limit 1
    `, [userId, sessionId]);
    if (latest.rowCount === 0) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const log = { type: "user" as const, sessionId, uuid: crypto.randomUUID(), parentUuid: latest.rows[0].uuid, message: { role: "user" as const, content: input.content } };
    await insertConversationLog(userId, log);
    return NextResponse.json({ event: log }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    if (error instanceof Error && error.message === "INVALID_SESSION_ID") return NextResponse.json({ error: "Invalid conversation ID." }, { status: 400 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "A message is required." }, { status: 400 });
    return NextResponse.json({ error: "We couldn't continue this conversation." }, { status: 503 });
  }
}
