import { NextResponse } from "next/server";
import { z } from "zod";

import { GmailConnectionError, getEmail, sendEmail } from "@/lib/gmail";
import { buildGmailReplyHeaders } from "@/lib/gmail-reply";
import { validatePermission } from "@/lib/message-permission";
import { requireUserId } from "@/lib/session";

const replySchema = z.object({
  body: z.string().trim().min(1, "Write a reply before sending.").max(100000, "Your reply is too long."),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const messageId = (await params).id;
    if (!validatePermission(userId, messageId, request.headers.get("x-message-permission"))) {
      return NextResponse.json({ error: "Open this message again before replying.", permissionRequired: true }, { status: 403 });
    }

    const { body } = replySchema.parse(await request.json());
    const original = await getEmail(userId, messageId);
    const headers = buildGmailReplyHeaders(original);
    const sent = await sendEmail(userId, { ...headers, body });

    return NextResponse.json({ ok: true, messageId: sent.id, threadId: sent.threadId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid reply." }, { status: 400 });
    if (error instanceof GmailConnectionError) return NextResponse.json({ error: error.message, reconnect: true }, { status: 401 });
    if (error instanceof Error && /reply address|threaded reply|Gmail thread|this draft/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("[gmail] reply failed", error);
    return NextResponse.json({ error: "We couldn't send the reply. Please try again." }, { status: 500 });
  }
}
