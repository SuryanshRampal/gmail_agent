import { NextResponse } from "next/server";
import { z } from "zod";

import { GmailConnectionError, sendEmail } from "@/lib/gmail";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";

async function prepareIdempotencyTable() {
  await db.query(`create table if not exists outbound_send_attempts ("userId" text not null, idempotency_key text not null, message_id text not null, status text not null, created_at timestamptz not null default now(), primary key ("userId", idempotency_key))`);
}

const emailSchema = z.object({ to: z.string().email("Enter a valid recipient email."), subject: z.string().trim().min(1, "Add a subject.").max(998), body: z.string().trim().min(1, "Write a message before sending.").max(100000) });

export async function POST(request: Request) {
  try {
    const email = emailSchema.parse(await request.json());
    const idempotencyKey = request.headers.get("x-idempotency-key");
    const userId = await requireUserId();
    if (idempotencyKey) {
      if (!/^[a-zA-Z0-9_-]{16,100}$/.test(idempotencyKey)) return NextResponse.json({ error: "Invalid send confirmation." }, { status: 400 });
      await prepareIdempotencyTable();
      const messageId = `<gmail-agent-${idempotencyKey}@localhost>`;
      const existing = await db.query<{ status: string }>(`select status from outbound_send_attempts where "userId" = $1 and idempotency_key = $2`, [userId, idempotencyKey]);
      if (existing.rows[0]?.status === "sent") return NextResponse.json({ ok: true, duplicate: true });
      if (!existing.rows[0]) await db.query(`insert into outbound_send_attempts ("userId", idempotency_key, message_id, status) values ($1, $2, $3, 'sending') on conflict do nothing`, [userId, idempotencyKey, messageId]);
      else if (existing.rows[0].status === "sending") return NextResponse.json({ error: "This email may already be sending. Please check Sent mail before retrying." }, { status: 409 });
      try {
        await sendEmail(userId, email, idempotencyKey);
      } catch (error) {
        // A returned Gmail error means the send was rejected; clear the reservation
        // so the user can safely retry. Network/parse failures remain reserved.
        if (error instanceof Error && error.message.startsWith("Gmail API request failed")) await db.query(`delete from outbound_send_attempts where "userId" = $1 and idempotency_key = $2`, [userId, idempotencyKey]);
        throw error;
      }
      await db.query(`update outbound_send_attempts set status = 'sent' where "userId" = $1 and idempotency_key = $2`, [userId, idempotencyKey]);
      return NextResponse.json({ ok: true });
    }
    await sendEmail(userId, email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid email." }, { status: 400 });
    if (error instanceof GmailConnectionError) return NextResponse.json({ error: error.message, reconnect: true }, { status: 401 });
    return NextResponse.json({ error: "We couldn't send the email. Please try again." }, { status: 500 });
  }
}
