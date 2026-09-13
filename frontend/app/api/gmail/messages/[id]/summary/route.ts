import { NextResponse } from "next/server";

import { GmailConnectionError, getEmail } from "@/lib/gmail";
import { requireUserId } from "@/lib/session";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const messageId = (await params).id;
    const email = await getEmail(userId, messageId);
    const agentKey = process.env.AGENT_SERVICE_KEY;
    if (!agentKey) throw new Error("The agent service is not configured.");
    const response = await fetch(`${(process.env.AGENT_API_URL ?? "http://localhost:8000").replace(/\/$/, "")}/agent/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Agent-Key": agentKey, "X-User-Id": userId },
      body: JSON.stringify({ message_id: messageId, content: `Subject: ${email.subject}\nFrom: ${email.sender}\nTo: ${email.recipients}\n\n${email.body ?? email.snippet}` }),
      cache: "no-store",
    });
    const data = await response.json() as { summary?: string; detail?: string };
    if (!response.ok) throw new Error(data.detail ?? "Agent summarization failed.");
    return NextResponse.json({ summary: data.summary });
  } catch (error) {
    console.error("[summary] request failed", error);
    if (error instanceof GmailConnectionError) return NextResponse.json({ error: error.message, reconnect: true }, { status: 401 });
    return NextResponse.json({ error: "We couldn't generate a summary for this email. Please try again." }, { status: 500 });
  }
}
