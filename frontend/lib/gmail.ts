import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/encryption";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailConnectionError extends Error {}
export type GmailMessage = { id: string; threadId: string; sender: string; recipients: string; subject: string; receivedAt: string; snippet: string; isUnread: boolean; body?: string };

type StoredAccount = { access_token: string | null; refresh_token: string | null; expires_at: number | null };

async function getAccessToken(userId: string): Promise<string> {
  const { rows } = await db.query<StoredAccount>("select access_token, refresh_token, expires_at from next_auth.accounts where userid = $1 and provider = 'google' order by id desc limit 1", [userId]);
  const account = rows[0];
  if (!account?.access_token) throw new GmailConnectionError("Gmail is not connected.");
  if (!account.expires_at || account.expires_at > Math.floor(Date.now() / 1000) + 60) return decryptToken(account.access_token);
  if (!account.refresh_token) throw new GmailConnectionError("Your Gmail connection has expired. Please reconnect your account.");

  const response = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.AUTH_GOOGLE_ID ?? "", client_secret: process.env.AUTH_GOOGLE_SECRET ?? "", grant_type: "refresh_token", refresh_token: decryptToken(account.refresh_token) }), cache: "no-store" });
  if (!response.ok) throw new GmailConnectionError("Your Gmail connection has expired. Please reconnect your account.");
  const token = await response.json() as { access_token: string; expires_in: number };
  await db.query("update next_auth.accounts set access_token = $1, expires_at = $2 where userid = $3 and provider = 'google'", [encryptToken(token.access_token), Math.floor(Date.now() / 1000) + token.expires_in, userId]);
  return token.access_token;
}

async function gmailFetch(userId: string, path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken(userId);
  const response = await fetch(`${GMAIL_API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...init?.headers }, cache: "no-store" });
  if (response.status === 401) throw new GmailConnectionError("Your Gmail connection has expired. Please reconnect your account.");
  if (!response.ok) throw new Error("Gmail API request failed.");
  return response;
}

function header(headers: Array<{ name: string; value: string }> | undefined, name: string) { return headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ?? ""; }
function decodeBase64Url(input = "") { return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"); }
function extractBody(payload: any): string {
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  for (const part of payload.parts ?? []) { const body = extractBody(part); if (body) return body; }
  return "";
}
function messageFromGoogle(message: any): GmailMessage {
  const labels = message.labelIds ?? [];
  return { id: message.id, threadId: message.threadId, sender: header(message.payload?.headers, "From"), recipients: header(message.payload?.headers, "To"), subject: header(message.payload?.headers, "Subject") || "(No subject)", receivedAt: header(message.payload?.headers, "Date"), snippet: message.snippet ?? "", isUnread: labels.includes("UNREAD"), body: extractBody(message.payload) };
}

export async function getEmails(userId: string): Promise<GmailMessage[]> {
  const list = await (await gmailFetch(userId, "/messages?maxResults=30&labelIds=INBOX")).json() as { messages?: Array<{ id: string }> };
  return Promise.all((list.messages ?? []).map(async ({ id }) => messageFromGoogle(await (await gmailFetch(userId, `/messages/${id}?format=full`)).json())));
}
export async function getEmail(userId: string, messageId: string): Promise<GmailMessage> { return messageFromGoogle(await (await gmailFetch(userId, `/messages/${encodeURIComponent(messageId)}?format=full`)).json()); }
export async function sendEmail(userId: string, email: { to: string; subject: string; body: string }) {
  const raw = Buffer.from([`To: ${email.to}`, `Subject: ${email.subject}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "", email.body].join("\r\n")).toString("base64url");
  return (await gmailFetch(userId, "/messages/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw }) })).json();
}
