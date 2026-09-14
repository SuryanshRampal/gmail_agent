import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/session";
import { issuePermission } from "@/lib/message-permission";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json() as { messageId?: string; preflightToken?: string };
    if (!body.messageId?.trim() || !body.preflightToken) return NextResponse.json({ error: "A valid preflight decision is required." }, { status: 400 });
    const permissionToken = await issuePermission(userId, body.messageId, body.preflightToken);
    if (!permissionToken) return NextResponse.json({ error: "The preflight decision is expired or invalid." }, { status: 403 });
    return NextResponse.json({ permissionToken });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    return NextResponse.json({ error: "We couldn't authorize this message." }, { status: 500 });
  }
}
