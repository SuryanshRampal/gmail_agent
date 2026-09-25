import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { decodeConversationLog, insertConversationLog } from "@/lib/conversation-logs";
import { requireUserId } from "@/lib/session";
import { clearConversationState, getCached, getConversationState, invalidateConversationCache, setCached, setConversationState } from "@/lib/redis-cache";
import { GmailConnectionError, sendEmail } from "@/lib/gmail";

const contentSchema = z.union([z.string().trim().min(1).max(100000), z.record(z.string(), z.unknown())]);
const continueSchema = z.object({ content: contentSchema, confirm: z.boolean().optional() });
type ConversationState = { intent: "send_email" | "draft_email"; status: "collecting" | "ready" | "completed"; draft?: { to: string; subject: string; body: string }; draftUuid?: string };
type DraftRecord = { draft: { to: string; subject: string; body: string }; draftUuid?: string };
const extractDraft = (log: unknown, draftUuid?: string): DraftRecord | null => { if (!log || typeof log !== "object") return null; const message = (log as Record<string, unknown>).message; if (!message || typeof message !== "object") return null; let content = (message as Record<string, unknown>).content; if (typeof content === "string") { try { content = JSON.parse(content) as unknown; } catch { return null; } } if (!content || typeof content !== "object") return null; const record = content as Record<string, unknown>; const candidate = record.event === "email_draft" && record.draft && typeof record.draft === "object" ? record.draft as Record<string, unknown> : record; if (typeof candidate.to !== "string" || typeof candidate.subject !== "string" || typeof candidate.body !== "string") return null; return { draft: { to: candidate.to, subject: candidate.subject, body: candidate.body }, draftUuid }; };

async function getSessionId(params: Promise<{ sessionId: string }>): Promise<string> {
  const sessionId = (await params).sessionId;
  if (!z.string().uuid().safeParse(sessionId).success) throw new Error("INVALID_SESSION_ID");
  return sessionId;
}

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const userId = await requireUserId();
    const sessionId = await getSessionId(params);
    const url = new URL(_request.url);
    const page = Math.max(0, Number.parseInt(url.searchParams.get("page") ?? "0", 10) || 0);
    const limit = Math.min(15, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "15", 10) || 15));
    const cacheKey = `conversations:events:${userId}:${sessionId}:${page}`;
    const cached = await getCached<{ sessionId: string; events: unknown[]; hasMore: boolean; nextPage: number | null }>(cacheKey);
    if (cached) return NextResponse.json(cached);
    const result = await db.query(`
      select "UUID" as "uuid", "SessionID" as "sessionId", "Logs" as "legacyLog", "EncryptedLogs" as "encryptedLog", created_at as "createdAt"
      from logs.conversation_events
      where "UserID" = $1 and "SessionID" = $2
      order by created_at desc, "UUID" desc
      limit $3 offset $4
    `, [userId, sessionId, limit + 1, page * limit]);
    if (result.rowCount === 0) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const hasMore = result.rows.length > limit;
    const events = result.rows.slice(0, limit).map((row) => ({ uuid: row.uuid, sessionId: row.sessionId, log: decodeConversationLog(row.encryptedLog, row.legacyLog), createdAt: row.createdAt })).reverse();
    const payload = { sessionId, events, hasMore, nextPage: hasMore ? page + 1 : null };
    await setCached(cacheKey, payload, 5 * 60);
    return NextResponse.json(payload);
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
    const userLog = { type: "user" as const, sessionId, uuid: crypto.randomUUID(), parentUuid: latest.rows[0].uuid, message: { role: "user" as const, content: input.content } };
    await insertConversationLog(userId, userLog);

    const contextResult = await db.query<{ uuid: string; legacyLog: unknown; encryptedLog: string | null }>(`
      select "UUID" as uuid, "Logs" as "legacyLog", "EncryptedLogs" as "encryptedLog"
      from logs.conversation_events
      where "UserID" = $1 and "SessionID" = $2
      order by created_at desc, "UUID" desc
      limit 50
    `, [userId, sessionId]);
    const decodedContext = contextResult.rows.map((row) => ({ uuid: row.uuid, log: decodeConversationLog(row.encryptedLog, row.legacyLog) }));
    const context = [...decodedContext].reverse().map((row) => JSON.stringify(row.log)).join("\n").slice(0, 30000);
    const requestText = typeof input.content === "string" ? input.content : JSON.stringify(input.content);
    const savedState = await getConversationState<ConversationState>(userId, sessionId);
    const inferredDraft = decodedContext.map((row) => extractDraft(row.log, row.uuid)).find((record): record is DraftRecord => Boolean(record));
    const draftRecord = savedState?.draft ? { draft: savedState.draft, draftUuid: savedState.draftUuid } : inferredDraft;
    const confirmationRequested = Boolean(draftRecord) && (input.confirm === true || /\b(send it|send this|send the draft|go ahead and send|good[, ]+send it)\b/i.test(requestText));
    if (confirmationRequested && draftRecord) {
      try {
        await sendEmail(userId, draftRecord.draft, crypto.randomUUID());
        const sentLog = { type: "assistant" as const, sessionId, uuid: crypto.randomUUID(), parentUuid: userLog.uuid, message: { role: "assistant" as const, content: { event: "email_sent", draftUuid: draftRecord.draftUuid, message: `Email sent successfully to ${draftRecord.draft.to}.` } } };
        await insertConversationLog(userId, sentLog);
        await clearConversationState(userId, sessionId);
        await invalidateConversationCache(userId, sessionId);
        return NextResponse.json({ events: [userLog, sentLog], sent: true }, { status: 201 });
      } catch (error) {
        const message = error instanceof GmailConnectionError ? error.message : "We couldn't send this email.";
        const errorLog = { type: "assistant" as const, sessionId, uuid: crypto.randomUUID(), parentUuid: userLog.uuid, message: { role: "assistant" as const, content: { event: "conversation_error", error: message } } };
        await insertConversationLog(userId, errorLog);
        return NextResponse.json({ events: [userLog, errorLog], error: message }, { status: 502 });
      }
    }
    const agentKey = process.env.AGENT_SERVICE_KEY;
    if (!agentKey) return NextResponse.json({ error: "The agent service is not configured.", events: [userLog] }, { status: 503 });
    const agentResponse = await fetch(`${(process.env.AGENT_API_URL ?? "http://localhost:8000").replace(/\/$/, "")}/agent/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Agent-Key": agentKey, "X-User-Id": userId },
      body: JSON.stringify({ request: requestText, context }),
      cache: "no-store",
    });
    const agentData = await agentResponse.json() as { draft?: object; clarification?: string; detail?: string };
    if (!agentResponse.ok) {
      const message = agentData.detail ?? "The drafting agent failed.";
      const errorLog = { type: "assistant" as const, sessionId, uuid: crypto.randomUUID(), parentUuid: userLog.uuid, message: { role: "assistant" as const, content: { event: "conversation_error", error: message } } };
      await insertConversationLog(userId, errorLog);
      return NextResponse.json({ error: message, events: [userLog, errorLog] }, { status: 502 });
    }
    const assistantContent: string | Record<string, unknown> = agentData.draft ? agentData.draft as Record<string, unknown> : agentData.clarification ?? "The agent did not return a response.";
    const wantsToSend = savedState?.intent === "send_email" || (/\b(send|send out|send another)\b/i.test(requestText) && !/\b(draft only|just draft|do not send|don't send)\b/i.test(requestText));
    if (wantsToSend && !agentData.draft) await setConversationState<ConversationState>(userId, sessionId, { intent: "send_email", status: "collecting" });
    if (agentData.draft && typeof agentData.draft === "object") {
      const draft = agentData.draft as { to?: unknown; subject?: unknown; body?: unknown };
      if (typeof draft.to !== "string" || typeof draft.subject !== "string" || typeof draft.body !== "string") {
        const errorLog = { type: "assistant" as const, sessionId, uuid: crypto.randomUUID(), parentUuid: userLog.uuid, message: { role: "assistant" as const, content: { event: "conversation_error", error: "The agent returned an incomplete email draft, so it was not sent." } } };
        await insertConversationLog(userId, errorLog);
        await setConversationState<ConversationState>(userId, sessionId, { intent: "send_email", status: "ready" });
        return NextResponse.json({ events: [userLog, errorLog], error: "The agent returned an incomplete email draft, so it was not sent." }, { status: 422 });
      }
      const to = draft.to as string;
      const subject = draft.subject as string;
      const body = draft.body as string;
      const draftUuid = crypto.randomUUID();
      const draftLog = { type: "assistant" as const, sessionId, uuid: draftUuid, parentUuid: userLog.uuid, message: { role: "assistant" as const, content: { event: "email_draft", draft: { to, subject, body }, requiresConfirmation: true } } };
      await insertConversationLog(userId, draftLog);
      await setConversationState<ConversationState>(userId, sessionId, { intent: "send_email", status: "ready", draft: { to, subject, body }, draftUuid });
      return NextResponse.json({ events: [userLog, draftLog], requiresConfirmation: true }, { status: 201 });
    }
    const assistantLog = { type: "assistant" as const, sessionId, uuid: crypto.randomUUID(), parentUuid: userLog.uuid, message: { role: "assistant" as const, content: assistantContent } };
    await insertConversationLog(userId, assistantLog);
    return NextResponse.json({ events: [userLog, assistantLog] }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    if (error instanceof Error && error.message === "INVALID_SESSION_ID") return NextResponse.json({ error: "Invalid conversation ID." }, { status: 400 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "A message is required." }, { status: 400 });
    return NextResponse.json({ error: "We couldn't continue this conversation." }, { status: 503 });
  }
}
