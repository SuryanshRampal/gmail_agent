import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { insertConversationLog } from "@/lib/conversation-logs";
import { requireUserId } from "@/lib/session";

const contentSchema = z.union([z.string().trim().min(1).max(100000), z.record(z.string(), z.unknown())]);
const startSchema = z.object({ content: contentSchema });

export async function GET() {
  try {
    const userId = await requireUserId();
    const result = await db.query(`
      select "SessionID" as "sessionId", count(*)::int as "eventCount",
             min(created_at) as "createdAt", max(created_at) as "updatedAt"
      from logs.conversation_events
      where "UserID" = $1
      group by "SessionID"
      order by max(created_at) desc
    `, [userId]);
    return NextResponse.json({ conversations: result.rows });
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
