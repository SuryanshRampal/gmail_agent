import { NextResponse } from "next/server";
import { z } from "zod";

import { insertConversationLog } from "@/lib/conversation-logs";
import { requireUserId } from "@/lib/session";

const logSchema = z.object({
  type: z.enum(["user", "assistant"]),
  sessionId: z.string().uuid(),
  uuid: z.string().uuid(),
  parentUuid: z.string().uuid().nullable(),
  message: z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(100000),
  }),
}).superRefine((value, context) => {
  if (value.type !== value.message.role) context.addIssue({ code: "custom", path: ["message", "role"], message: "Message role must match log type." });
});

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const log = logSchema.parse(await request.json());
    await insertConversationLog(userId, log);
    return NextResponse.json({ ok: true, uuid: log.uuid });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid conversation log." }, { status: 400 });
    return NextResponse.json({ error: "We couldn't save this conversation." }, { status: 503 });
  }
}
