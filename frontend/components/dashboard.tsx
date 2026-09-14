"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CalendarDays, ChevronDown, LoaderCircle, Mail, Send, Sparkles } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { NavUser } from "@/components/nav-user";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar, type DateRange } from "@/components/ui/calendar";
import { resolveDateRange, toGmailBoundary, type RangeMode } from "@/lib/date-range";

type Message = { id: string; sender: string; recipients: string; subject: string; receivedAt: string; snippet: string; isUnread: boolean; body?: string; bodyHtml?: string; bodyText?: string };
type AccessGuard = { decision: "allow" | "permission_required" | "blocked"; categories: string[]; warning: string; permissionToken?: string };
type User = { name?: string | null; email?: string | null; image?: string | null };
const initial = (value?: string | null) => value?.slice(0, 1).toUpperCase() || "U";
const formatDate = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date); };
const emailDocument = (html: string) => html
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<base[^>]*>/gi, "")
  .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, "")
  .replace(/<head([^>]*)>/i, `<head$1><style>
    html, body { margin: 0; padding: 0; background: #fff; color: #202124; }
    body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
    img { max-width: 100% !important; height: auto !important; }
    table { max-width: 100%; } pre { white-space: pre-wrap; }
  </style>`);
const summaryMarkdownComponents = {
  a: ({ href, children, ...props }: React.ComponentProps<"a">) => {
    const action = /click|open|view|share|submit|complete|register|confirm|feedback|survey/i.test(String(children));
    return <a {...props} href={href} className={action ? "summary-action-button" : undefined} target="_blank" rel="noreferrer">{children}</a>;
  },
};
const shortDate = (date?: Date) => date ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date) : "";

export function Dashboard({ user }: { user: User }) {
  const [view, setView] = useState<"inbox" | "compose">("inbox");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [rangeMode, setRangeMode] = useState<RangeMode>("recent");
  const [dateRange, setDateRange] = useState<DateRange>({ from: new Date(), to: new Date() });
  const [rangeOpen, setRangeOpen] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [pageError, setPageError] = useState("");
  const [accessGuard, setAccessGuard] = useState<AccessGuard | null>(null);
  const [messagePermission, setMessagePermission] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [timePreset, setTimePreset] = useState<"all" | "15" | "30">("30");
  type MessagePage = { messages?: Message[]; nextPageToken?: string; resultSizeEstimate?: number; error?: string };
  type PrefetchedPage = { key: string; pageToken: string; data: MessagePage };
  const requestNumber = useRef(0);
  const activeRequestKey = useRef("");
  const prefetchedPage = useRef<PrefetchedPage | null>(null);
  const prefetchingPage = useRef("");

  const requestKey = (mode: RangeMode, range: DateRange, query: string, preset: "all" | "15" | "30") =>
    JSON.stringify([mode, range.from?.getTime(), range.to?.getTime(), query.trim(), preset]);

  const requestPage = async (mode: RangeMode, range: DateRange, continuation: string | undefined, query: string, preset: "all" | "15" | "30") => {
    const resolved = query.trim() || preset === "all" ? null : resolveDateRange(mode, range, new Date(), preset === "15" ? 15 : 30);
    if (!query.trim() && preset !== "all" && !resolved) return null;
    const params = new URLSearchParams({ mode, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    if (resolved) {
      params.set("from", toGmailBoundary(resolved.from, true));
      params.set("to", toGmailBoundary(resolved.to));
    }
    if (preset === "all" && !query.trim()) params.set("allTime", "true");
    if (query.trim()) params.set("search", query.trim());
    if (continuation) params.set("pageToken", continuation);
    const response = await fetch(`/api/gmail/messages?${params.toString()}`);
    const data = await response.json() as MessagePage;
    if (!response.ok) throw new Error(data.error);
    return data;
  };

  const prefetchPage = async (key: string, pageToken: string | undefined, mode: RangeMode, range: DateRange, query: string, preset: "all" | "15" | "30") => {
    if (!pageToken || prefetchingPage.current === `${key}:${pageToken}`) return;
    if (prefetchedPage.current?.key === key && prefetchedPage.current.pageToken === pageToken) return;
    const prefetchKey = `${key}:${pageToken}`;
    prefetchingPage.current = prefetchKey;
    try {
      const data = await requestPage(mode, range, pageToken, query, preset);
      if (data && activeRequestKey.current === key) prefetchedPage.current = { key, pageToken, data };
    } catch {
      // A look-ahead request is opportunistic; the explicit Load More action retries it if needed.
    } finally {
      if (prefetchingPage.current === prefetchKey) prefetchingPage.current = "";
    }
  };

  const loadMessages = async (mode: RangeMode = rangeMode, range: DateRange = dateRange, append = false, continuation?: string, query = searchQuery, preset = timePreset) => {
    const currentRequest = ++requestNumber.current;
    const key = requestKey(mode, range, query, preset);
    activeRequestKey.current = key;
    if (!append) prefetchedPage.current = null;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setPageError("");
    if (!append) setError("");
    try {
      const cached = append && continuation && prefetchedPage.current?.key === key && prefetchedPage.current.pageToken === continuation ? prefetchedPage.current.data : null;
      const data = cached ?? await requestPage(mode, range, continuation, query, preset);
      if (!data) return;
      if (cached) prefetchedPage.current = null;
      if (currentRequest !== requestNumber.current) return;
      setMessages((existing) => append ? [...existing, ...(data.messages ?? [])] : (data.messages ?? []));
      setNextPageToken(data.nextPageToken);
      if (data.nextPageToken) void prefetchPage(key, data.nextPageToken, mode, range, query, preset);
      if (!append) { setSelected(null); setSummary(""); }
    } catch (caught) {
      if (currentRequest !== requestNumber.current) return;
      const message = caught instanceof Error ? caught.message : "We couldn't access this Gmail page right now. Please try again.";
      if (append) setPageError(message);
      else setError(message);
    } finally {
      if (currentRequest === requestNumber.current) {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    }
  };
  // The initial request intentionally uses the default range captured on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timer = window.setTimeout(() => { void loadMessages("recent"); }, 0); return () => window.clearTimeout(timer); }, []);
  const openEmail = async (message: Message) => { setView("inbox"); setSelected({ ...message, body: undefined }); setAccessGuard(null); setMessagePermission(""); setSummary(""); try { const preflight = await fetch("/api/gmail/messages/preflight", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message_id: message.id, sender: message.sender, subject: message.subject, snippet: message.snippet, received_at: message.receivedAt }) }); const assessed = await preflight.json() as { result?: AccessGuard; accessToken?: string; preflightToken?: string; error?: string }; if (!preflight.ok || !assessed.result) throw new Error(assessed.error); if (assessed.result.decision !== "allow") { setAccessGuard({ ...assessed.result, permissionToken: assessed.preflightToken, decision: assessed.result.decision === "blocked" ? "blocked" : "permission_required" }); return; } setMessagePermission(assessed.accessToken ?? ""); const response = await fetch(`/api/gmail/messages/${message.id}`, { headers: { "X-Message-Permission": assessed.accessToken ?? "" } }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setSelected(data); } catch (caught) { setError(caught instanceof Error ? caught.message : "We couldn't access this email."); } };
  const grantMessagePermission = async () => { if (!selected || !accessGuard) return; try { const response = await fetch("/api/gmail/messages/permission", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: selected.id, preflightToken: accessGuard.permissionToken }) }); const data = await response.json() as { permissionToken?: string; error?: string }; if (!response.ok || !data.permissionToken) throw new Error(data.error); setMessagePermission(data.permissionToken); const full = await fetch(`/api/gmail/messages/${selected.id}`, { headers: { "X-Message-Permission": data.permissionToken } }); const email = await full.json(); if (!full.ok) throw new Error(email.error); setAccessGuard(null); setSelected(email); } catch (caught) { setError(caught instanceof Error ? caught.message : "We couldn't open this message."); } };
  const generateSummary = async () => { if (!selected || !messagePermission) return; setSummarizing(true); setSummary(""); try { const response = await fetch(`/api/gmail/messages/${selected.id}/summary`, { method: "POST", headers: { "X-Message-Permission": messagePermission } }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setSummary(data.summary); } catch (caught) { setSummary(caught instanceof Error ? caught.message : "We couldn't generate a summary for this email. Please try again."); } finally { setSummarizing(false); } };
  const send = async (form: HTMLFormElement) => { const values = new FormData(form); setSending(true); setNotice(""); try { const response = await fetch("/api/gmail/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: values.get("to"), subject: values.get("subject"), body: values.get("body") }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); form.reset(); setNotice("Email sent successfully."); } catch (caught) { setNotice(caught instanceof Error ? caught.message : "We couldn't send the email. Please try again."); } finally { setSending(false); } };

  const visibleMessages = messages;
	return <SidebarProvider defaultOpen style={{ "--sidebar-width": "clamp(28rem, 30vw, 32rem)" } as React.CSSProperties}><AppSidebar user={user} view={view} messages={visibleMessages} selectedId={selected?.id} unreadCount={visibleMessages.filter((message) => message.isUnread).length} hasMore={Boolean(nextPageToken)} loadingMore={loadingMore} searching={loading} pageError={pageError} onSearch={(query) => { setSearchQuery(query); void loadMessages(rangeMode, dateRange, false, undefined, query); }} onLoadMore={() => { if (nextPageToken) void loadMessages(rangeMode, dateRange, true, nextPageToken); }} onRetryPage={() => { if (nextPageToken) void loadMessages(rangeMode, dateRange, true, nextPageToken); }} onViewChange={(nextView) => { setView(nextView); if (nextView === "compose") setSelected(null); }} onSelectMessage={(message) => void openEmail(message)} onRefresh={() => void loadMessages()} /><SidebarInset className="min-w-0 bg-[#171721]"><header className="sticky top-0 z-10 flex min-h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-[#171721]/90 px-5 py-3 backdrop-blur-xl md:px-8"><SidebarTrigger className="text-white/60 hover:bg-white/8 hover:text-white" /><Separator orientation="vertical" className="h-5 bg-white/15" /><div className="min-w-0 flex-1"><p className="text-xs font-medium uppercase tracking-[.18em] text-white/35">{view === "compose" ? "New message" : "Inbox"}</p>{view === "compose" ? <p className="text-sm text-white/75">Write to someone</p> : <RangeControls searchQuery={searchQuery} timePreset={timePreset} onPresetChange={(preset) => { setTimePreset(preset); setRangeMode("recent"); setRangeOpen(false); void loadMessages("recent", dateRange, false, undefined, searchQuery, preset); }} rangeMode={rangeMode} dateRange={dateRange} rangeOpen={rangeOpen} setRangeOpen={setRangeOpen} setDateRange={setDateRange} onCustomRange={(range) => { setRangeMode("period"); setTimePreset("30"); setRangeOpen(false); void loadMessages("period", range); }} />}</div><NavUser placement="header" user={{ name: user.name ?? "User", email: user.email ?? "", avatar: user.image ?? "" }} /></header><main className="mx-auto w-full max-w-[90rem] flex-1 p-4 md:p-6 lg:p-8">{view === "compose" ? <ComposeForm sending={sending} notice={notice} onCancel={() => setView("inbox")} onSend={send} /> : error ? <div className="error-card"><p>{error}</p>{error.includes("connection") && <button className="button button-primary" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>Reconnect Gmail</button>}</div> : loading ? <SkeletonRows /> : selected ? <Reader message={selected} accessGuard={accessGuard} onGrantAccess={() => void grantMessagePermission()} summary={summary} summarizing={summarizing} onSummarize={() => void generateSummary()} /> : <div className="empty-state"><Mail size={26}/><h2>{visibleMessages.length ? "Select a message" : "No messages in this range"}</h2><p>{visibleMessages.length ? "Choose an email from your inbox to read it here." : "Try another date range to see more of your inbox."}</p></div>}</main></SidebarInset></SidebarProvider>;
}

function RangeControls({ searchQuery, timePreset, onPresetChange, rangeMode, dateRange, rangeOpen, setRangeOpen, setDateRange, onCustomRange }: { searchQuery: string; timePreset: "all" | "15" | "30"; onPresetChange: (preset: "all" | "15" | "30") => void; rangeMode: RangeMode; dateRange: DateRange; rangeOpen: boolean; setRangeOpen: (open: boolean) => void; setDateRange: (range: DateRange) => void; onCustomRange: (range: DateRange) => void }) {
  const currentLabel = searchQuery.trim() || timePreset === "all" ? "All Time" : timePreset === "15" ? "Last 15 days" : timePreset === "30" && rangeMode === "recent" ? "Last 30 days" : dateRange.from && dateRange.to ? `${shortDate(dateRange.from)} – ${shortDate(dateRange.to)}` : "Choose date range";
  return <div className="relative flex flex-wrap items-center gap-2"><DropdownMenu><DropdownMenuTrigger className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-white/75 hover:bg-white/8 hover:text-white">{timePreset === "all" ? "All Time" : timePreset === "15" ? "Last 15 days" : "Last 30 days"}<ChevronDown className="size-3" /></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={() => onPresetChange("all")}>All Time</DropdownMenuItem><DropdownMenuItem onClick={() => onPresetChange("15")}>Last 15 days</DropdownMenuItem><DropdownMenuItem onClick={() => onPresetChange("30")}>Last 30 days</DropdownMenuItem></DropdownMenuContent></DropdownMenu><DropdownMenu open={rangeOpen} onOpenChange={setRangeOpen}><DropdownMenuTrigger className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-white/55 hover:bg-white/8 hover:text-white"><CalendarDays className="size-3" /> Custom date range</DropdownMenuTrigger><DropdownMenuContent className="w-auto p-3"><Calendar selected={dateRange} onSelect={(next) => { setDateRange(next); if (next.from && next.to) onCustomRange(next); }} numberOfMonths={2} /></DropdownMenuContent></DropdownMenu><span className="basis-full text-xs text-white/45">{currentLabel}</span></div>
}

function ComposeForm({ sending, notice, onCancel, onSend }: { sending: boolean; notice: string; onCancel: () => void; onSend: (form: HTMLFormElement) => void }) {
  const [mode, setMode] = useState<"manual" | "agent">("manual");
  return <section className="compose-card border border-white/10 shadow-2xl shadow-black/10"><div className="section-heading"><div><p className="eyebrow">NEW MESSAGE</p><h1>{mode === "agent" ? "Ask the agent to write." : "Compose with intention."}</h1></div></div><div className="compose-tabs"><button type="button" className={mode === "manual" ? "active" : ""} onClick={() => setMode("manual")}>Write myself</button><button type="button" className={mode === "agent" ? "active" : ""} onClick={() => setMode("agent")}><Sparkles size={14} /> Draft with AI</button></div>{mode === "agent" ? <AgentDraftForm onCancel={onCancel} /> : <form className="compose-form" onSubmit={(event) => { event.preventDefault(); onSend(event.currentTarget); }}><label>To<input name="to" type="email" placeholder="recipient@example.com" required /></label><label>Subject<input name="subject" placeholder="What is this about?" required /></label><label>Message<textarea name="body" placeholder="Write your message…" required /></label>{notice && <p className="form-notice">{notice}</p>}<div className="compose-actions"><button type="button" className="button button-ghost" onClick={onCancel}>Cancel</button><button type="submit" className="button button-primary" disabled={sending}>{sending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} {sending ? "Sending…" : "Send email"}</button></div></form>}</section>
}

type AgentDraft = { to: string; subject: string; body: string; assumptions: string[] };
function AgentDraftForm({ onCancel }: { onCancel: () => void }) {
  const [request, setRequest] = useState("");
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [draftToken, setDraftToken] = useState("");
  const [clarification, setClarification] = useState("");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);
  const [sent, setSent] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [edited, setEdited] = useState(false);
  const createDraft = async () => { setWorking(true); setStatus(""); setClarification(""); try { const response = await fetch("/api/agent/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request }) }); const data = await response.json() as { draft?: AgentDraft; draftToken?: string; clarification?: string; error?: string }; if (!response.ok) throw new Error(data.error); if (data.clarification) setClarification(data.clarification); else if (data.draft && data.draftToken) { setDraft(data.draft); setDraftToken(data.draftToken); setEdited(false); setSent(false); setIdempotencyKey(""); } } catch (caught) { setStatus(caught instanceof Error ? caught.message : "We couldn't create a draft."); } finally { setWorking(false); } };
  const sendDraft = async () => { if (!draft || !draftToken) return; setWorking(true); setStatus(""); const key = idempotencyKey || crypto.randomUUID(); setIdempotencyKey(key); try { const response = await fetch("/api/agent/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, draftToken, idempotencyKey: key }) }); const data = await response.json() as { error?: string }; if (!response.ok) throw new Error(data.error); setSent(true); setStatus("Email sent successfully."); } catch (caught) { setStatus(caught instanceof Error ? caught.message : "We couldn't send this email. Your draft is preserved."); } finally { setWorking(false); } };
  const markEdited = () => { setEdited(true); setSent(false); setStatus("Draft changed. Create a new draft before sending."); };
  const resetDraft = () => { setDraft(null); setDraftToken(""); setEdited(false); setSent(false); setStatus(""); setIdempotencyKey(""); };
  return <div className="agent-compose"><label>What should the email say?<textarea value={request} onChange={(event) => { setRequest(event.target.value); resetDraft(); setClarification(""); }} placeholder="Write to alex@example.com thanking them for the introduction. Keep it warm and concise." required /></label>{clarification && <div className="agent-clarification"><Sparkles size={15} /><span>{clarification}</span></div>}{draft && <div className="agent-draft"><div className="agent-draft-label"><Sparkles size={14} /> Review AI draft before sending</div><label>To<input value={draft.to} onChange={(event) => { setDraft({ ...draft, to: event.target.value }); markEdited(); }} /></label><label>Subject<input value={draft.subject} onChange={(event) => { setDraft({ ...draft, subject: event.target.value }); markEdited(); }} /></label><label>Message<textarea value={draft.body} onChange={(event) => { setDraft({ ...draft, body: event.target.value }); markEdited(); }} /></label>{draft.assumptions.length > 0 && <div className="agent-assumptions"><strong>Assumptions to review</strong><ul>{draft.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></div>}{edited && <p className="agent-clarification">This reviewed version changed. Create a new draft to refresh the confirmation.</p>}{!sent && <button type="button" className="button button-primary" onClick={() => void sendDraft()} disabled={working || edited || !draftToken || !draft.to || !draft.subject || !draft.body}>{working ? <><LoaderCircle className="spin" size={16} /> Sending…</> : <><Send size={16} /> Send reviewed email</>}</button>}{edited && <button type="button" className="button button-ghost" onClick={() => void createDraft()} disabled={working || !request.trim()}>{working ? "Writing…" : "Create new draft"}</button>}</div>}{status && <p className="form-notice">{status}</p>}<div className="compose-actions"><button type="button" className="button button-ghost" onClick={onCancel}>Cancel</button>{!draft && <button type="button" className="button button-primary" onClick={() => void createDraft()} disabled={working || !request.trim()}>{working ? <><LoaderCircle className="spin" size={16} /> Writing…</> : <><Sparkles size={16} /> Create draft</>}</button>}</div></div>
}

function Reader({ message, accessGuard, onGrantAccess, summary, summarizing, onSummarize }: { message: Message; accessGuard: AccessGuard | null; onGrantAccess: () => void; summary: string; summarizing: boolean; onSummarize: () => void }) { return <article className="message-reader"><div className="reader-kicker"><span className="eyebrow">MESSAGE</span><span className="reader-date">{formatDate(message.receivedAt)}</span></div><h1>{message.subject}</h1><div className="reader-meta"><span className="reader-avatar">{initial(message.sender)}</span><div><strong>{message.sender || "Unknown sender"}</strong><span>to {message.recipients || "you"}</span></div><time>{message.receivedAt}</time></div>{accessGuard ? <div className="agent-clarification" role="alert"><Sparkles size={18} /><div><strong>Permission required before opening</strong><p>{accessGuard.warning}</p><p>This only uses the message envelope. The body, attachments, and images remain closed until you approve access.</p><div className="compose-actions"><button type="button" className="button button-primary" onClick={onGrantAccess}>Open message</button><button type="button" className="button button-ghost">Keep closed</button></div></div></div> : <div className="email-body">{message.body === undefined ? <span className="loading-line"><LoaderCircle className="spin" size={17}/> Loading email…</span> : message.bodyHtml ? <iframe className="email-frame" title="Email content" sandbox="" srcDoc={emailDocument(message.bodyHtml)} /> : <div className="plain-email">{message.bodyText || message.body || message.snippet}</div>}</div>} {!accessGuard && <section className="summary-card"><div className="summary-content"><div className="summary-heading"><div><p className="eyebrow"><Sparkles size={13}/> AI EMAIL BRIEF</p><h2>{summary ? "Everything you need, at a glance." : "Turn this email into a decision-ready brief."}</h2></div>{summary && <span className="summary-badge">Generated</span>}</div>{summary ? <div className="summary-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={summaryMarkdownComponents}>{summary}</ReactMarkdown></div> : <p className="summary-placeholder">Get the context, important details, next step, and relevant terms in a concise, polished format.</p>}</div><div className="summary-actions"><button className="button button-primary" onClick={onSummarize} disabled={summarizing || message.body === undefined}>{summarizing ? <LoaderCircle className="spin" size={16}/> : <Sparkles size={16}/>} {summarizing ? "Building brief…" : summary ? "Refresh brief" : "Create brief"}</button><span>Grounded in this email</span></div></section>}</article> }

function SkeletonRows() { return <div className="skeleton-rows">{Array.from({ length: 6 }, (_, index) => <div className="skeleton-row" key={index}><i/><span><b/><em/></span></div>)}</div> }
