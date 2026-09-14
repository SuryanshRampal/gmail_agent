import { NextResponse } from "next/server";

import { GmailConnectionError, getEmail } from "@/lib/gmail";
import { requireUserId } from "@/lib/session";
import { validatePermission } from "@/lib/message-permission";
import { randomUUID } from "crypto";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const { id } = await params;
  console.info("[api/gmail/messages/:id] request started", { requestId, messageId: id });
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "X-Request-Id": requestId } });
  try {
    const userId = await requireUserId();
    const permission = request.headers.get("x-message-permission");
    if (!permission) return json({ error: "Permission is required before opening this message.", permissionRequired: true }, 403);
    if (!validatePermission(userId, id, permission)) return json({ error: "Message permission is invalid or expired.", permissionRequired: true }, 403);
    const email = await getEmail(userId, id, { requestId });
    console.info("[api/gmail/messages/:id] request completed", { requestId, messageId: id, durationMs: Date.now() - startedAt });
    return json(email);
  }
  catch (error) {
    console.error("[api/gmail/messages/:id] request failed", { requestId, messageId: id, durationMs: Date.now() - startedAt, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ error: "Please sign in to continue." }, 401);
    if (error instanceof GmailConnectionError) return json({ error: error.message, reconnect: true }, 401);
    return json({ error: "We couldn't access this email right now. Please try again." }, 500);
  }
}
