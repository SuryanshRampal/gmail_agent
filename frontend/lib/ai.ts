export async function summarizeEmail(content: string): Promise<string> {
  const prompt = `Summarize this email concisely. Include: main point, important information, action items, deadlines, and decisions or open questions. If absent, do not invent them.\n\n${content.slice(0, 30000)}`;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openRouterKey && !openAiKey) throw new Error("AI summaries are not configured.");

  const response = openRouterKey
    ? await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openRouterKey}`, "Content-Type": "application/json", "HTTP-Referer": process.env.NEXTAUTH_URL ?? "http://localhost:3000", "X-Title": "Gmail Agent" },
        body: JSON.stringify({ model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini", messages: [{ role: "user", content: prompt }] }),
        cache: "no-store",
      })
    : await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? "gpt-5-mini", store: false, input: prompt }),
        cache: "no-store",
      });
  if (!response.ok) throw new Error(`The summary provider returned HTTP ${response.status}.`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> };
  const text = data.choices?.[0]?.message?.content ?? data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error("The summary provider returned no content.");
  return text;
}
