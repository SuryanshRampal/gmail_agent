import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/encryption";
import { googleOAuthCredentials } from "@/lib/auth";
import { clearOAuthAccountTokens } from "@/lib/auth/oauth-account-store";
import { oauthEnvironment } from "@/lib/oauth-environment";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailConnectionError extends Error {}
export type GmailMessage = { id: string; threadId: string; sender: string; recipients: string; subject: string; receivedAt: string; snippet: string; isUnread: boolean; isSent: boolean; isDraft: boolean; replyTo?: string; returnPath?: string; authenticationResults?: string; messageIdHeader?: string; references?: string; body?: string; bodyHtml?: string; bodyText?: string };

type StoredAccount = { access_token: string | null; refresh_token: string | null; expires_at: number | null };
export type GmailRequestContext = { requestId?: string };

function log(context: GmailRequestContext | undefined, message: string, details?: Record<string, unknown>) {
  console.info(`[gmail] ${message}`, { requestId: context?.requestId, ...details });
}

function logError(context: GmailRequestContext | undefined, message: string, error: unknown, details?: Record<string, unknown>) {
  console.error(`[gmail] ${message}`, {
    requestId: context?.requestId,
    ...details,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
  });
}

async function getAccessToken(userId: string, context?: GmailRequestContext): Promise<string> {
  const startedAt = Date.now();
  log(context, "loading stored Google account", { userId });
  const { rows } = await db.query<StoredAccount>("select access_token, refresh_token, expires_at from next_auth.accounts where \"userId\" = $1 and provider = 'google' and oauth_environment = $2 order by id desc limit 1", [userId, oauthEnvironment]);
  const account = rows[0];
  log(context, "stored Google account loaded", { hasAccount: Boolean(account), hasAccessToken: Boolean(account?.access_token), hasRefreshToken: Boolean(account?.refresh_token), expiresAt: account?.expires_at ?? null, durationMs: Date.now() - startedAt });
  if (!account?.access_token) throw new GmailConnectionError("Gmail is not connected.");
  if (!account.expires_at || account.expires_at > Math.floor(Date.now() / 1000) + 60) {
    try {
      const token = decryptToken(account.access_token);
      log(context, "using stored Google access token", { durationMs: Date.now() - startedAt });
      return token;
    } catch (error) {
      logError(context, "failed to decrypt stored Google access token", error);
      throw error;
    }
  }
  if (!account.refresh_token) throw new GmailConnectionError("Your Gmail connection has expired. Please reconnect your account.");

  log(context, "refreshing expired Google access token");
  const response = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: googleOAuthCredentials.clientId, client_secret: googleOAuthCredentials.clientSecret, grant_type: "refresh_token", refresh_token: decryptToken(account.refresh_token) }), cache: "no-store" });
  if (!response.ok) {
    let errorPayload: { error?: string; error_description?: string; error_subtype?: string } = {};
    try { errorPayload = await response.json() as typeof errorPayload; } catch { /* Keep the HTTP status when Google returns no JSON. */ }
    log(context, "Google token refresh failed", { status: response.status, statusText: response.statusText, googleError: errorPayload.error, googleErrorDescription: errorPayload.error_description, googleErrorSubtype: errorPayload.error_subtype });
    if (errorPayload.error === "invalid_grant") {
      try {
        await clearOAuthAccountTokens(db, userId, "google", oauthEnvironment);
        log(context, "cleared revoked Google account tokens", { userId, oauthEnvironment });
      } catch (error) {
        logError(context, "failed to clear revoked Google account tokens", error, { userId, oauthEnvironment });
      }
    }
    throw new GmailConnectionError("Your Gmail connection has expired. Please reconnect your account.");
  }
  const token = await response.json() as { access_token: string; expires_in: number; refresh_token?: string };
  log(context, "Google access token refreshed", { expiresIn: token.expires_in });
  await db.query("update next_auth.accounts set access_token = $1, refresh_token = coalesce($2, refresh_token), expires_at = $3 where \"userId\" = $4 and provider = 'google' and oauth_environment = $5", [encryptToken(token.access_token), token.refresh_token ? encryptToken(token.refresh_token) : null, Math.floor(Date.now() / 1000) + token.expires_in, userId, oauthEnvironment]);
  return token.access_token;
}

async function gmailFetch(userId: string, path: string, init?: RequestInit, context?: GmailRequestContext): Promise<Response> {
  const startedAt = Date.now();
  log(context, "calling Gmail API", { method: init?.method ?? "GET", path });
  const token = await getAccessToken(userId, context);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${GMAIL_API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...init?.headers }, cache: "no-store" });
    log(context, "Gmail API responded", { method: init?.method ?? "GET", path, status: response.status, statusText: response.statusText, durationMs: Date.now() - startedAt, attempt: attempt + 1 });
    if (response.status === 401) throw new GmailConnectionError("Your Gmail connection has expired. Please reconnect your account.");
    if (response.ok) return response;

    let payload: { error?: { code?: number; message?: string; status?: string; errors?: Array<{ reason?: string; domain?: string }> } } = {};
    try { payload = await response.clone().json(); } catch { /* Keep the HTTP status when Gmail returns no JSON. */ }
    const reasons = payload.error?.errors?.map((item) => item.reason).filter(Boolean) ?? [];
    const retryable = response.status === 429 || response.status === 500 || response.status === 503 || (response.status === 403 && reasons.some((reason) => reason === "userRateLimitExceeded" || reason === "rateLimitExceeded" || reason === "backendError"));
    log(context, "Gmail API request failed", { method: init?.method ?? "GET", path, status: response.status, errorDetails: payload.error, retryable, attempt: attempt + 1 });
    if (!retryable || attempt === 4) throw new Error(`Gmail API request failed (${response.status})${payload.error?.message ? `: ${payload.error.message}` : "."}`);
    const retryAfter = Number(response.headers.get("retry-after"));
    await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * (attempt + 1)));
  }
  throw new Error("Gmail API request failed.");
}

function header(headers: Array<{ name: string; value: string }> | undefined, name: string) { return headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ?? ""; }
function decodeBase64Url(input = "") { return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"); }
function extractBodies(payload: any, result = { html: "", text: "" }) {
  const content = payload.body?.data ? decodeBase64Url(payload.body.data) : "";
  if (content && payload.mimeType === "text/html" && !result.html) result.html = content;
  if (content && payload.mimeType === "text/plain" && !result.text) result.text = content;
  for (const part of payload.parts ?? []) extractBodies(part, result);
  return result;
}
async function inlineImages(userId: string, message: any, html: string, context?: GmailRequestContext) {
  if (!html) return html;
  const parts: any[] = [];
  const visit = (part: any) => { if (part.filename && part.body?.attachmentId) parts.push(part); for (const child of part.parts ?? []) visit(child); };
  visit(message.payload);
  await Promise.all(parts.map(async (part) => {
    const contentId = header(part.headers, "Content-ID").replace(/[<>]/g, "");
    if (!contentId) return;
    const attachment = await (await gmailFetch(userId, `/messages/${encodeURIComponent(message.id)}/attachments/${encodeURIComponent(part.body.attachmentId)}`, undefined, context)).json() as { data?: string };
    if (attachment.data) html = html.replaceAll(`cid:${contentId}`, `data:${part.mimeType};base64,${attachment.data.replace(/-/g, "+").replace(/_/g, "/")}`);
  }));
  return html;
}
async function messageFromGoogle(userId: string, message: any, resolveImages = false, context?: GmailRequestContext): Promise<GmailMessage> {
  const labels = message.labelIds ?? [];
  const bodies = extractBodies(message.payload);
  const bodyHtml = resolveImages ? await inlineImages(userId, message, bodies.html, context) : bodies.html;
  return { id: message.id, threadId: message.threadId, sender: header(message.payload?.headers, "From"), recipients: header(message.payload?.headers, "To"), subject: header(message.payload?.headers, "Subject") || "(No subject)", receivedAt: header(message.payload?.headers, "Date"), snippet: message.snippet ?? "", isUnread: labels.includes("UNREAD"), isSent: labels.includes("SENT"), isDraft: labels.includes("DRAFT"), replyTo: header(message.payload?.headers, "Reply-To"), returnPath: header(message.payload?.headers, "Return-Path"), authenticationResults: header(message.payload?.headers, "Authentication-Results"), messageIdHeader: header(message.payload?.headers, "Message-ID"), references: header(message.payload?.headers, "References"), body: bodyHtml || bodies.text, bodyHtml, bodyText: bodies.text };
}

export type MailboxFolder = "inbox" | "sent" | "drafts" | "trash" | "spam" | "starred" | "archive";
export type EmailRange = { mode?: "recent" | "date" | "period"; from?: string; to?: string; pageToken?: string; search?: string; allTime?: boolean; folder?: MailboxFolder };
export type GmailEmailPage = { messages: GmailMessage[]; nextPageToken?: string; resultSizeEstimate?: number };

function gmailPhrase(value: string) { return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`; }
export function expandGmailSearch(value: string): string {
  const input = value.trim();
  if (!input) return "";
  const variants = new Set<string>([input]);
  const normalized = input.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  if (normalized !== input) variants.add(gmailPhrase(normalized));
  const compact = normalized.replace(/\s/g, "");
  if (compact.length >= 5 && compact !== input) variants.add(compact);
  if (/^[a-z0-9]+$/i.test(compact) && compact.length >= 5) {
    for (let index = 2; index <= compact.length - 2 && variants.size < 10; index += 1) variants.add(gmailPhrase(`${compact.slice(0, index)} ${compact.slice(index)}`));
  }
  return variants.size === 1 ? input : `{${[...variants].join(" ")}}`;
}

export async function getEmails(userId: string, range: EmailRange = {}, context?: GmailRequestContext): Promise<GmailEmailPage> {
  const search = range.search?.trim();
  const folder = range.folder ?? "inbox";
  const folderQuery: Record<MailboxFolder, string> = {
    inbox: "in:inbox",
    sent: "in:sent",
    drafts: "in:drafts",
    trash: "in:trash",
    spam: "in:spam",
    starred: "is:starred",
    archive: "-in:inbox -in:sent -in:drafts -in:trash -in:spam",
  };
  const dateQuery = range.from && range.to ? `after:${range.from} before:${range.to}` : range.allTime ? "" : "newer_than:30d";
  const query = [folderQuery[folder], search ? expandGmailSearch(search) : "", dateQuery].filter(Boolean).join(" ");
  const ids: Array<{ id: string }> = [];
  const params = new URLSearchParams({ maxResults: "25", q: query });
  if (range.pageToken) params.set("pageToken", range.pageToken);
  const list = await (await gmailFetch(userId, `/messages?${params.toString()}`, undefined, context)).json() as { messages?: Array<{ id: string }>; nextPageToken?: string; resultSizeEstimate?: number };
  ids.push(...(list.messages ?? []));
  log(context, "Gmail inbox list parsed", { messageCount: ids.length, query, hasNextPage: Boolean(list.nextPageToken), resultSizeEstimate: list.resultSizeEstimate });
  const metadataParams = new URLSearchParams({ format: "metadata" });
  for (const name of ["From", "To", "Subject", "Date", "Reply-To", "Return-Path", "Authentication-Results", "Message-ID", "References"]) metadataParams.append("metadataHeaders", name);
  const emails: GmailMessage[] = [];
  for (let index = 0; index < ids.length; index += 2) {
    const batch = ids.slice(index, index + 2);
    const loaded = await Promise.all(batch.map(async ({ id }) => {
      const response = await gmailFetch(userId, `/messages/${encodeURIComponent(id)}?${metadataParams.toString()}`, undefined, context);
      return messageFromGoogle(userId, await response.json(), false, context);
    }));
    emails.push(...loaded);
  }
  return { messages: emails, nextPageToken: list.nextPageToken, resultSizeEstimate: list.resultSizeEstimate };
}
export async function getEmail(userId: string, messageId: string, context?: GmailRequestContext): Promise<GmailMessage> {
  log(context, "loading Gmail message", { userId, messageId });
  const message = await (await gmailFetch(userId, `/messages/${encodeURIComponent(messageId)}?format=full`, undefined, context)).json();
  log(context, "Gmail message payload parsed", { messageId, hasPayload: Boolean(message?.payload), partCount: message?.payload?.parts?.length ?? 0, labelCount: message?.labelIds?.length ?? 0 });
  return messageFromGoogle(userId, message, true, context);
}
export async function sendEmail(userId: string, email: { to: string; subject: string; body: string; threadId?: string; inReplyTo?: string; references?: string }, idempotencyKey?: string) {
  const messageId = idempotencyKey ? `<gmail-agent-${idempotencyKey}@localhost>` : undefined;
  const safeHeader = (value: string) => value.replace(/[\r\n]+/g, " ").trim();
  const raw = Buffer.from([`To: ${safeHeader(email.to)}`, `Subject: ${safeHeader(email.subject)}`, ...(email.inReplyTo ? [`In-Reply-To: ${safeHeader(email.inReplyTo)}`] : []), ...(email.references ? [`References: ${safeHeader(email.references)}`] : []), ...(messageId ? [`Message-ID: ${messageId}`] : []), "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "", email.body].join("\r\n")).toString("base64url");
  return (await gmailFetch(userId, "/messages/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw, ...(email.threadId ? { threadId: email.threadId } : {}) }) })).json();
}
