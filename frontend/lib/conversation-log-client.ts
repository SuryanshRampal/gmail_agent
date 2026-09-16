export type ClientLogContent = string | Record<string, unknown>;

export async function appendConversationLog(input: {
  type: "user" | "assistant";
  sessionId: string;
  parentUuid: string | null;
  content: ClientLogContent;
}): Promise<string | null> {
  const uuid = crypto.randomUUID();
  try {
    const response = await fetch("/api/agent/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: input.type,
        sessionId: input.sessionId,
        uuid,
        parentUuid: input.parentUuid,
        message: { role: input.type, content: input.content },
      }),
    });
    return response.ok ? uuid : null;
  } catch {
    // Logging is best-effort and must not interrupt email work.
    return null;
  }
}
