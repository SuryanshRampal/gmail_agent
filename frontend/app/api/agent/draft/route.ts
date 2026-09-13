import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/session";
import { decryptToken, encryptToken } from "@/lib/encryption";

type DraftEnvelope = { userId?: string; draft?: object; expiresAt?: number };

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const token = new URL(request.url).searchParams.get("token");
    if (!token) return NextResponse.json({ error: "A draft token is required." }, { status: 400 });
    let envelope: DraftEnvelope;
    try { envelope = JSON.parse(decryptToken(token)) as DraftEnvelope; } catch { return NextResponse.json({ error: "This draft has expired." }, { status: 410 }); }
    if (envelope.userId !== userId || !envelope.draft || !envelope.expiresAt || envelope.expiresAt < Date.now()) return NextResponse.json({ error: "This draft is unavailable." }, { status: 404 });
    return NextResponse.json({ draft: envelope.draft, expiresAt: envelope.expiresAt });
  } catch {
    return NextResponse.json({ error: "We couldn't retrieve this email draft." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json() as { request?: string };
    if (!body.request?.trim()) return NextResponse.json({ error: "Tell the agent what email to write." }, { status: 400 });
    const agentKey = process.env.AGENT_SERVICE_KEY;
    if (!agentKey) return NextResponse.json({ error: "The agent service is not configured." }, { status: 503 });
    const response = await fetch(`${(process.env.AGENT_API_URL ?? "http://localhost:8000").replace(/\/$/, "")}/agent/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Agent-Key": agentKey, "X-User-Id": userId },
      body: JSON.stringify({ request: body.request }),
      cache: "no-store",
    });
    const data = await response.json() as { draft?: object; clarification?: string; detail?: string };
    if (!response.ok) return NextResponse.json({ error: data.detail ?? "The drafting agent failed." }, { status: 502 });
    if (data.draft) return NextResponse.json({ draft: data.draft, draftToken: encryptToken(JSON.stringify({ userId, draft: data.draft, expiresAt: Date.now() + 15 * 60 * 1000 })) });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "We couldn't create an email draft. Please try again." }, { status: 500 });
  }
}
