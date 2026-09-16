import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/session";
import { encryptToken } from "@/lib/encryption";
import { createPreflightNonce } from "@/lib/message-permission";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const envelope = await request.json() as { message_id?: string; sender?: string; subject?: string; snippet?: string; received_at?: string };
    if (!envelope.message_id) return NextResponse.json({ error: "A message is required." }, { status: 400 });
    const agentKey = process.env.AGENT_SERVICE_KEY;
    if (!agentKey) return NextResponse.json({ error: "The sensitivity guardrail is not configured." }, { status: 503 });
    const response = await fetch(`${(process.env.AGENT_API_URL ?? "http://localhost:8000").replace(/\/$/, "")}/agent/preflight`, { method: "POST", headers: { "Content-Type": "application/json", "X-Agent-Key": agentKey, "X-User-Id": userId }, body: JSON.stringify(envelope), cache: "no-store" });
    const data = await response.json() as { result?: object; detail?: string };
    if (!response.ok) return NextResponse.json({ error: data.detail ?? "Sensitivity assessment failed." }, { status: 502 });
    const result = data.result as { decision?: string; warning?: string } | undefined;
    const normalizedData = result?.warning?.includes("uncertain information")
      ? {
          ...data,
          result: {
            ...result,
            warning: "This message could contain sensitive information, but we couldn't determine its category safely. Permission is required before opening its contents.",
          },
        }
      : data;
    const accessToken = result?.decision === "allow" ? encryptToken(JSON.stringify({ userId, messageId: envelope.message_id, expiresAt: Date.now() + 10 * 60 * 1000 })) : undefined;
    const preflightToken = result?.decision === "allow" ? undefined : await createPreflightNonce(userId, envelope.message_id);
    return NextResponse.json({ ...normalizedData, accessToken, preflightToken });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    return NextResponse.json({ error: "We couldn't assess this message safely." }, { status: 503 });
  }
}
