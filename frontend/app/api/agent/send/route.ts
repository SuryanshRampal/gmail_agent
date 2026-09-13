import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { decryptToken } from "@/lib/encryption";
import { GmailConnectionError, sendEmail } from "@/lib/gmail";
import { requireUserId } from "@/lib/session";

const requestSchema = z.object({ draftToken: z.string().min(1), idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{16,100}$/), to: z.string().email(), subject: z.string().trim().min(1).max(998), body: z.string().trim().min(1).max(100000) });
async function prepareTable() { await db.query(`create table if not exists outbound_send_attempts ("userId" text not null, idempotency_key text not null, message_id text not null, status text not null, created_at timestamptz not null default now(), primary key ("userId", idempotency_key))`); }

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const input = requestSchema.parse(await request.json());
    let token: { userId?: string; draft?: { to?: string; subject?: string; body?: string }; expiresAt?: number };
    try { token = JSON.parse(decryptToken(input.draftToken)); } catch { return NextResponse.json({ error: "This draft has expired. Create a new draft before sending." }, { status: 400 }); }
    if (token.userId !== userId || !token.draft || !token.expiresAt || token.expiresAt < Date.now() || token.draft.to !== input.to || token.draft.subject !== input.subject || token.draft.body !== input.body) return NextResponse.json({ error: "Please review and confirm the current draft before sending." }, { status: 409 });
    await prepareTable();
    const messageId = `<gmail-agent-${input.idempotencyKey}@localhost>`;
    const existing = await db.query<{ status: string }>(`select status from outbound_send_attempts where "userId" = $1 and idempotency_key = $2`, [userId, input.idempotencyKey]);
    if (existing.rows[0]?.status === "sent") return NextResponse.json({ ok: true, duplicate: true });
    if (existing.rows[0]?.status === "sending") return NextResponse.json({ error: "This email may already be sending. Please check Sent mail before retrying." }, { status: 409 });
    await db.query(`insert into outbound_send_attempts ("userId", idempotency_key, message_id, status) values ($1, $2, $3, 'sending') on conflict do nothing`, [userId, input.idempotencyKey, messageId]);
    try { await sendEmail(userId, { to: input.to, subject: input.subject, body: input.body }, input.idempotencyKey); } catch (error) { if (error instanceof Error && error.message.startsWith("Gmail API request failed")) await db.query(`delete from outbound_send_attempts where "userId" = $1 and idempotency_key = $2`, [userId, input.idempotencyKey]); throw error; }
    await db.query(`update outbound_send_attempts set status = 'sent' where "userId" = $1 and idempotency_key = $2`, [userId, input.idempotencyKey]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid draft." }, { status: 400 });
    if (error instanceof GmailConnectionError) return NextResponse.json({ error: error.message, reconnect: true }, { status: 401 });
    return NextResponse.json({ error: "We couldn't send this email. Your reviewed draft is preserved." }, { status: 500 });
  }
}
