export async function summarizeEmail(content: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) throw new Error("AI summaries are not configured.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? "gpt-5-mini", store: false, input: `Summarize this email concisely. Include: main point, important information, action items, deadlines, and decisions or open questions. If absent, do not invent them.\n\n${content.slice(0, 30000)}` }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("The summary provider could not be reached.");
  const data = await response.json() as { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> };
  const text = data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error("The summary provider returned no content.");
  return text;
}
