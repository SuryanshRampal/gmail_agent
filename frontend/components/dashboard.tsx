"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CalendarClock, CalendarDays, ChevronDown, LoaderCircle, Mail, Menu, Send, Sparkles } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar, type DateRange } from "@/components/ui/calendar";
import { resolveDateRange, toGmailBoundary, type RangeMode } from "@/lib/date-range";
import { scanEmailContent, type ContentScan } from "@/lib/phishing";
import { appendConversationLog } from "@/lib/conversation-log-client";
import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble";
import { Shimmer } from "@/components/ui/shimmer";

type Message = { id: string; sender: string; recipients: string; subject: string; receivedAt: string; snippet: string; isUnread: boolean; replyTo?: string; returnPath?: string; authenticationResults?: string; body?: string; bodyHtml?: string; bodyText?: string };
type PhishingAssessment = { risk_level: "low_risk" | "needs_attention" | "high_risk" | "unable_to_verify"; confidence_band: "low" | "medium" | "high"; reasons: string[]; link_count: number; bounded: boolean };
type AccessGuard = { decision: "allow" | "permission_required" | "blocked"; categories: string[]; warning: string; phishing?: PhishingAssessment; permissionToken?: string };
type User = { name?: string | null; email?: string | null; image?: string | null };
type Folder = "inbox" | "sent" | "drafts" | "trash" | "spam" | "starred" | "archive";
const initial = (value?: string | null) => value?.slice(0, 1).toUpperCase() || "U";
const formatDate = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date); };
const emailDocument = (html: string, blockedLinks: string[] = []) => html
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<base[^>]*>/gi, "")
  .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, "")
  .replace(/<form\b[\s\S]*?<\/form>/gi, "")
  .replace(/<a\b([^>]*?)\bhref\s*=\s*(["'])([^"']+)\2([^>]*)>/gi, (_match, before, quote, href, after) => blockedLinks.includes(href) ? `<a${before}href="#blocked-link" aria-disabled="true" title="This link was blocked by the phishing scan"${after}>` : `<a${before}href=${quote}${href}${quote}${after}>`)
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
const MESSAGE_CACHE_TTL_MS = 120_000;
const MESSAGE_PAGE_SIZE = 25;
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function HighlightedText({ text, query }: { text: string; query: string }) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length || !text) return <>{text}</>;
  const normalizedTerms = terms.map((term) => term.replace(/[._-]+/g, "")).filter(Boolean);
  const compactQuery = normalizedTerms.join("");
  const phrasePattern = terms.length > 1 ? terms.map(escapeRegex).join("[\\s._-]+") : "";
  const patterns = [...new Set([
    ...terms.map(escapeRegex),
    ...normalizedTerms.filter((term) => term.length > 1).map(escapeRegex),
    compactQuery.length > 1 ? escapeRegex(compactQuery) : "",
    phrasePattern,
  ].filter(Boolean))].sort((left, right) => right.length - left.length);
  const matcher = new RegExp(`(${patterns.join("|")})`, "gi");
  return <>{text.split(matcher).map((part, index) => index % 2 === 1 ? <mark className="search-highlight" key={`${part}-${index}`}>{part}</mark> : part)}</>;
}

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
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageStartTokens, setPageStartTokens] = useState<Array<string | undefined>>([undefined]);
  const [pageError, setPageError] = useState("");
  const [accessGuard, setAccessGuard] = useState<AccessGuard | null>(null);
  const [messagePermission, setMessagePermission] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [timePreset, setTimePreset] = useState<"all" | "15" | "30">("30");
  const [folder, setFolder] = useState<Folder>("inbox");
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
  const [contentScan, setContentScan] = useState<ContentScan | null>(null);
  type MessagePage = { messages?: Message[]; nextPageToken?: string; resultSizeEstimate?: number; error?: string };
  type CachedPage = { data: MessagePage; cachedAt: number };
  const requestNumber = useRef(0);
  const conversationSessionId = useRef(crypto.randomUUID());
  const conversationPreviousUuid = useRef<string | null>(null);
  const activeRequestKey = useRef("");
  const prefetchingPages = useRef(new Set<string>());
  const messageCache = useRef(new Map<string, CachedPage>());

  const requestKey = (mode: RangeMode, range: DateRange, query: string, preset: "all" | "15" | "30", mailbox: Folder) =>
    JSON.stringify([mode, range.from?.getTime(), range.to?.getTime(), query.trim(), preset, mailbox]);
  const pageCacheKey = (key: string, continuation?: string) => `${key}::${continuation ?? "first"}`;

  const requestPage = async (mode: RangeMode, range: DateRange, continuation: string | undefined, query: string, preset: "all" | "15" | "30", mailbox: Folder) => {
    const resolved = query.trim() || preset === "all" ? null : resolveDateRange(mode, range, new Date(), preset === "15" ? 15 : 30);
    if (!query.trim() && preset !== "all" && !resolved) return null;
    const params = new URLSearchParams({ mode, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    if (resolved) {
      params.set("from", toGmailBoundary(resolved.from, true));
      params.set("to", toGmailBoundary(resolved.to));
    }
    if (preset === "all" || query.trim()) params.set("allTime", "true");
    if (query.trim()) params.set("search", query.trim());
    params.set("folder", mailbox);
    if (continuation) params.set("pageToken", continuation);
    const response = await fetch(`/api/gmail/messages?${params.toString()}`);
    const data = await response.json() as MessagePage;
    if (!response.ok) throw new Error(data.error);
    return data;
  };

  const prefetchPages = async (key: string, pageToken: string | undefined, mode: RangeMode, range: DateRange, query: string, preset: "all" | "15" | "30", mailbox: Folder) => {
    if (!pageToken || prefetchingPages.current.has(key)) return;
    prefetchingPages.current.add(key);
    try {
      let continuation: string | undefined = pageToken;
      for (let page = 0; page < 2 && continuation; page += 1) {
        if (activeRequestKey.current !== key) return;
        const cacheKey = pageCacheKey(key, continuation);
        const cachedEntry = messageCache.current.get(cacheKey);
        const cached = cachedEntry && Date.now() - cachedEntry.cachedAt < MESSAGE_CACHE_TTL_MS ? cachedEntry.data : null;
        if (cachedEntry && !cached) messageCache.current.delete(cacheKey);
        const data: MessagePage | null = cached ?? await requestPage(mode, range, continuation, query, preset, mailbox);
        if (!data) return;
        if (!cached) messageCache.current.set(cacheKey, { data, cachedAt: Date.now() });
        continuation = data.nextPageToken;
      }
    } catch {
      // Background look-ahead is opportunistic; pagination retries it if needed.
    } finally {
      prefetchingPages.current.delete(key);
    }
  };

  const loadMessages = async (mode: RangeMode = rangeMode, range: DateRange = dateRange, append = false, continuation?: string, query = searchQuery, preset = timePreset, mailbox: Folder = folder, forceRefresh = false) => {
    const currentRequest = ++requestNumber.current;
    const key = requestKey(mode, range, query, preset, mailbox);
    activeRequestKey.current = key;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setPageError("");
    if (!append) setError("");
    try {
      const cacheKey = pageCacheKey(key, continuation);
      if (forceRefresh) {
        for (const cachedKey of messageCache.current.keys()) if (cachedKey.startsWith(`${key}::`)) messageCache.current.delete(cachedKey);
      }
      const cachedEntry = !append && !forceRefresh ? messageCache.current.get(cacheKey) : undefined;
      const cached = cachedEntry && Date.now() - cachedEntry.cachedAt < MESSAGE_CACHE_TTL_MS ? cachedEntry.data : null;
      if (cachedEntry && !cached) messageCache.current.delete(cacheKey);
      const data = cached ?? await requestPage(mode, range, continuation, query, preset, mailbox);
      if (!data) return;
      if (!append && !cached) messageCache.current.set(cacheKey, { data, cachedAt: Date.now() });
      if (currentRequest !== requestNumber.current) return;
      setMessages((existing) => append ? [...existing, ...(data.messages ?? [])] : (data.messages ?? []));
      if (!append && mailbox === "inbox") setInboxUnreadCount((data.messages ?? []).filter((message) => message.isUnread).length);
      setNextPageToken(data.nextPageToken);
      setTotalPages(Math.max(pageNumber, 1, Math.ceil((data.resultSizeEstimate ?? data.messages?.length ?? 0) / MESSAGE_PAGE_SIZE)));
      if (data.nextPageToken) void prefetchPages(key, data.nextPageToken, mode, range, query, preset, mailbox);
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
  useEffect(() => { const sessionId = new URLSearchParams(window.location.search).get("resume"); if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) return; const timer = window.setTimeout(() => setView("compose"), 0); return () => window.clearTimeout(timer); }, []);
  const appendLog = async (type: "user" | "assistant", content: string | Record<string, unknown>) => { const uuid = await appendConversationLog({ type, sessionId: conversationSessionId.current, parentUuid: conversationPreviousUuid.current, content }); if (uuid) conversationPreviousUuid.current = uuid; };
  const openEmail = async (message: Message) => { setView("inbox"); setSelected({ ...message, body: undefined }); setContentScan(null); setAccessGuard(null); setMessagePermission(""); setSummary(""); void appendLog("user", `Requested access assessment for email ${message.id}: ${message.subject}`); try { const preflight = await fetch("/api/gmail/messages/preflight", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message_id: message.id, sender: message.sender, subject: message.subject, snippet: message.snippet, received_at: message.receivedAt, reply_to: message.replyTo, return_path: message.returnPath, authentication_results: message.authenticationResults }) }); const assessed = await preflight.json() as { result?: AccessGuard; accessToken?: string; preflightToken?: string; error?: string }; if (!preflight.ok || !assessed.result) throw new Error(assessed.error); void appendLog("assistant", { event: "security_assessment", messageId: message.id, subject: message.subject, decision: assessed.result.decision, categories: assessed.result.categories, warning: assessed.result.warning }); if (assessed.result.decision !== "allow") { setAccessGuard({ ...assessed.result, permissionToken: assessed.preflightToken, decision: assessed.result.decision === "blocked" ? "blocked" : "permission_required" }); return; } setMessagePermission(assessed.accessToken ?? ""); const response = await fetch(`/api/gmail/messages/${message.id}`, { headers: { "X-Message-Permission": assessed.accessToken ?? "" } }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setContentScan(scanEmailContent(data.bodyHtml, data.bodyText || data.body)); setSelected(data); } catch (caught) { const errorMessage = caught instanceof Error ? caught.message : "The security assessment service was unavailable."; void appendLog("assistant", `Security assessment failed for email ${message.id}: ${errorMessage}`); setAccessGuard({ decision: "permission_required", categories: ["uncertain"], warning: "We couldn't verify this message's security. Retry the assessment before opening its contents.", phishing: { risk_level: "unable_to_verify", confidence_band: "low", reasons: ["The security assessment service was unavailable."], link_count: 0, bounded: true } }); } };
  const grantMessagePermission = async () => { if (!selected || !accessGuard) return; void appendLog("user", `Approved opening email ${selected.id}: ${selected.subject}`); try { const response = await fetch("/api/gmail/messages/permission", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: selected.id, preflightToken: accessGuard.permissionToken }) }); const data = await response.json() as { permissionToken?: string; error?: string }; if (!response.ok || !data.permissionToken) throw new Error(data.error); setMessagePermission(data.permissionToken); const full = await fetch(`/api/gmail/messages/${selected.id}`, { headers: { "X-Message-Permission": data.permissionToken } }); const email = await full.json(); if (!full.ok) throw new Error(email.error); setContentScan(scanEmailContent(email.bodyHtml, email.bodyText || email.body)); setAccessGuard(null); setSelected(email); void appendLog("assistant", { event: "permission_granted", messageId: selected.id, subject: selected.subject }); } catch (caught) { const errorMessage = caught instanceof Error ? caught.message : "We couldn't open this message."; void appendLog("assistant", `Permission request failed for email ${selected.id}: ${errorMessage}`); setError(errorMessage); } };
  const generateSummary = async () => { if (!selected || !messagePermission) return; setSummarizing(true); setSummary(""); void appendLog("user", `Requested an AI summary for email ${selected.id}: ${selected.subject}`); try { const response = await fetch(`/api/gmail/messages/${selected.id}/summary`, { method: "POST", headers: { "X-Message-Permission": messagePermission } }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setSummary(data.summary); await appendLog("assistant", { event: "email_summary", messageId: selected.id, subject: selected.subject, summary: data.summary }); } catch (caught) { const errorMessage = caught instanceof Error ? caught.message : "We couldn't generate a summary for this email. Please try again."; setSummary(errorMessage); await appendLog("assistant", `Summary failed for email ${selected.id}: ${errorMessage}`); } finally { setSummarizing(false); } };
  const send = async (form: HTMLFormElement) => { const values = new FormData(form); setSending(true); setNotice(""); try { const response = await fetch("/api/gmail/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: values.get("to"), subject: values.get("subject"), body: values.get("body") }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); form.reset(); setNotice("Email sent successfully."); } catch (caught) { setNotice(caught instanceof Error ? caught.message : "We couldn't send the email. Please try again."); } finally { setSending(false); } };

  const visibleMessages = messages;
  const showInitialSkeleton = loading && messages.length === 0 && !searchQuery.trim();
  const closeReader = () => { setSelected(null); setAccessGuard(null); setContentScan(null); setSummary(""); };
  const folderLabel: Record<Folder, string> = { inbox: "Inbox", sent: "Sent", drafts: "Drafts", trash: "Trash", spam: "Spam", starred: "Starred", archive: "Archive" };
  const reconnectGmail = async () => {
    await signOut({ redirect: false });
    await signIn("google", { callbackUrl: "/dashboard" }, { access_type: "offline", prompt: "consent" });
  };
  const resetPagination = () => { setPageNumber(1); setTotalPages(1); setPageStartTokens([undefined]); };
  const goToNextPage = () => {
    if (!nextPageToken || loading) return;
    const nextPage = pageNumber + 1;
    setPageStartTokens((tokens) => tokens.length > nextPage ? tokens : [...tokens, nextPageToken]);
    setPageNumber(nextPage);
    void loadMessages(rangeMode, dateRange, false, nextPageToken);
  };
  const goToPreviousPage = () => {
    if (pageNumber <= 1 || loading) return;
    const previousPage = pageNumber - 1;
    setPageNumber(previousPage);
    void loadMessages(rangeMode, dateRange, false, pageStartTokens[previousPage - 1]);
  };
  const refreshCurrentPage = () => void loadMessages(rangeMode, dateRange, false, pageStartTokens[pageNumber - 1], searchQuery, timePreset, folder, true);

  return <SidebarProvider defaultOpen style={{ "--sidebar-width": "14rem" } as React.CSSProperties}>
    <AppSidebar user={user} view={view} folder={folder} unreadCount={inboxUnreadCount} onFolderChange={(next) => { setFolder(next); setSearchQuery(""); resetPagination(); void loadMessages(rangeMode, dateRange, false, undefined, "", timePreset, next); }} onViewChange={(nextView) => { setView(nextView); if (nextView === "compose") closeReader(); }} onRefresh={refreshCurrentPage} />
    <SidebarInset className="min-w-0 bg-[#171721]">
      <header className="sticky top-0 z-10 flex min-h-12 shrink-0 items-center gap-4 border-b border-white/10 bg-[#171721]/90 px-4 py-2 backdrop-blur-xl md:px-6">
        <SidebarTrigger aria-label="Main menu" title="Main menu" className="size-8 rounded-xl bg-[#6574f5] text-white shadow-[0_0_20px_rgba(101,116,245,.28)] hover:bg-[#7180ff] hover:text-white"><Menu className="size-4" /></SidebarTrigger><Separator orientation="vertical" className="my-auto h-8 !w-px rounded-full bg-[#6574f5]/90" />
        <div className="min-w-0 flex-1">{view === "compose" ? <><p className="text-xs font-medium uppercase tracking-[.18em] text-white/35">New message</p><p className="text-sm text-white/75">Write to someone</p></> : <RangeControls searchQuery={searchQuery} timePreset={timePreset} onPresetChange={(preset) => { setTimePreset(preset); setRangeMode("recent"); setRangeOpen(false); resetPagination(); void loadMessages("recent", dateRange, false, undefined, searchQuery, preset); }} rangeMode={rangeMode} dateRange={dateRange} rangeOpen={rangeOpen} setRangeOpen={setRangeOpen} setDateRange={setDateRange} onCustomRange={(range) => { setRangeMode("period"); setTimePreset("30"); setRangeOpen(false); resetPagination(); void loadMessages("period", range); }} />}</div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-3 md:p-5 lg:p-6">
        {view === "compose" ? <ComposeForm sending={sending} notice={notice} onCancel={() => setView("inbox")} onSend={send} /> : error ? <div className="error-card"><p>{error}</p>{error.includes("connection") && <button className="button button-primary" onClick={() => void reconnectGmail()}>Reconnect Gmail</button>}</div> : showInitialSkeleton ? <SkeletonRows /> : <MessageList folderLabel={folderLabel[folder]} messages={visibleMessages} query={searchQuery} searching={loading && Boolean(searchQuery.trim())} pageNumber={pageNumber} totalPages={totalPages} canGoPrevious={pageNumber > 1} canGoNext={Boolean(nextPageToken)} loadingPage={loading} pageError={pageError} onSearch={(query) => { setSearchQuery(query); resetPagination(); void loadMessages(rangeMode, dateRange, false, undefined, query); }} onSelectMessage={(message) => void openEmail(message)} onPreviousPage={goToPreviousPage} onNextPage={goToNextPage} onRetryPage={refreshCurrentPage} />}
      </main>
    </SidebarInset>
    {selected && <Sheet open onOpenChange={(open) => { if (!open) closeReader(); }}><SheetContent side="right" className="w-full gap-0 overflow-hidden border-white/10 bg-[#1e1e2a] p-0 text-white sm:!max-w-none md:w-[62vw] md:max-w-[980px]"><SheetTitle className="sr-only">{selected.subject}</SheetTitle><div className="flex-1 overflow-y-auto p-4 md:p-6"><Reader message={selected} accessGuard={accessGuard} contentScan={contentScan} onGrantAccess={() => void grantMessagePermission()} onRetryAssessment={() => void openEmail(selected)} onKeepClosed={closeReader} summary={summary} summarizing={summarizing} onSummarize={() => void generateSummary()} /></div></SheetContent></Sheet>}
  </SidebarProvider>;
}

function MessageList({ folderLabel, messages, query, searching, pageNumber, totalPages, canGoPrevious, canGoNext, loadingPage, pageError, onSearch, onSelectMessage, onPreviousPage, onNextPage, onRetryPage }: { folderLabel: string; messages: Message[]; query: string; searching: boolean; pageNumber: number; totalPages: number; canGoPrevious: boolean; canGoNext: boolean; loadingPage: boolean; pageError: string; onSearch: (query: string) => void; onSelectMessage: (message: Message) => void; onPreviousPage: () => void; onNextPage: () => void; onRetryPage: () => void }) {
  return <section className="inbox-message-list overflow-hidden rounded border border-white/10 bg-[#1e1e2a] shadow-xl shadow-[#6574f5]/30"><div className="inbox-list-header border-b border-white/10 p-4 shadow-xl shadow-black/80 md:p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl">{folderLabel}</h1><p className="mt-1 text-xs text-white/50">{messages.length} messages in this view</p></div><div className="flex items-center gap-2"><label className="relative w-full max-w-sm"><span className="sr-only">Search messages</span><input value={query} onChange={(event) => onSearch(event.target.value)} placeholder={`Search ${folderLabel.toLowerCase()}…`} className="h-6 w-80 rounded-full border border-white/30 bg-[#6574f5] px-3 text-sm text-black/50 shadow-xl shadow-white/10 outline-none transition-colors placeholder:text-sm placeholder:text-black/50 focus:border-[#6574f5]/60" /></label><div className="-translate-y-0.5 flex items-center gap-0.5 text-[10px] text-white/45"><button type="button" aria-label="Previous page" onClick={onPreviousPage} disabled={!canGoPrevious || loadingPage} className="rounded-full px-1.5 py-0.5 transition-colors hover:bg-[#6574f5]/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-30">‹</button>{loadingPage && <LoaderCircle className="spin size-3 text-[#aeb8ff]" aria-label="Loading page" />}<span className="min-w-7 text-center" aria-live="polite">{pageNumber}/{totalPages}</span><button type="button" aria-label="Next page" onClick={onNextPage} disabled={!canGoNext || loadingPage} className="rounded-full px-1.5 py-0.5 transition-colors hover:bg-[#6574f5]/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-30">›</button></div></div></div></div><div>{messages.length === 0 ? <div className="empty-state border-0 bg-transparent"><Mail size={26}/><h2>{searching ? "Searching messages…" : `No messages in ${folderLabel.toLowerCase()}`}</h2><p>{query ? "Try a different search phrase." : "This folder is currently empty."}</p></div> : messages.map((message) => <button key={message.id} type="button" onClick={() => onSelectMessage(message)} className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-white/8 px-4 py-3.5 text-left shadow-xl shadow-black/80 transition-colors hover:bg-[#6574f5]/10 md:px-6"><span className={`row-span-2 flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#8290ff] via-[#6574f5] to-[#4556d9] text-xs font-semibold text-white shadow-[0_4px_10px_rgba(101,116,245,.35)] ${message.isUnread ? "" : "bg-none bg-white/10 text-white/60 shadow-none"}`}>{initial(message.sender)}</span><span className={`min-w-0 truncate text-[13px] ${message.isUnread ? "font-semibold text-white" : "text-white/75"}`}><HighlightedText text={message.sender || "Unknown sender"} query={query} /></span><time className="text-[9px] text-white/55">{formatDate(message.receivedAt)}</time><span className={`col-start-2 min-w-0 truncate text-[13px] ${message.isUnread ? "font-medium text-white/90" : "text-white/55"}`}><HighlightedText text={message.subject} query={query} /><span className="ml-2 text-white/35">— <HighlightedText text={message.snippet} query={query} /></span></span></button>)}</div>{pageError && <div className="px-5 py-4 text-sm text-red-200/80"><p>This page could not be loaded.</p><button type="button" className="mt-2 text-[#aeb8ff] underline underline-offset-2" onClick={onRetryPage}>Retry</button></div>}</section>
}

function RangeControls({ searchQuery, timePreset, onPresetChange, rangeMode, dateRange, rangeOpen, setRangeOpen, setDateRange, onCustomRange }: { searchQuery: string; timePreset: "all" | "15" | "30"; onPresetChange: (preset: "all" | "15" | "30") => void; rangeMode: RangeMode; dateRange: DateRange; rangeOpen: boolean; setRangeOpen: (open: boolean) => void; setDateRange: (range: DateRange) => void; onCustomRange: (range: DateRange) => void }) {
  const currentLabel = searchQuery.trim() || timePreset === "all" ? "All Time" : timePreset === "15" ? "Last 15 days" : timePreset === "30" && rangeMode === "recent" ? "Last 30 days" : dateRange.from && dateRange.to ? `${shortDate(dateRange.from)} – ${shortDate(dateRange.to)}` : "Choose date range";
  return <div className="relative flex flex-wrap items-center gap-2"><DropdownMenu><DropdownMenuTrigger aria-label={`Date filter: ${currentLabel}`} className="group flex h-8 w-9 items-center gap-2 overflow-hidden rounded-full px-2 text-sm text-white/75 transition-[width,background-color] duration-200 hover:w-36 hover:bg-[#6574f5]/15 hover:text-white focus-visible:w-36 focus-visible:bg-[#6574f5]/15 data-[state=open]:w-36 data-[state=open]:bg-[#6574f5]/15"><CalendarClock className="size-4 shrink-0" /><span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-200 group-hover:max-w-28 group-hover:opacity-100 group-focus-visible:max-w-28 group-focus-visible:opacity-100 group-data-[state=open]:max-w-28 group-data-[state=open]:opacity-100">{timePreset === "all" ? "All Time" : timePreset === "15" ? "Last 15 days" : "Last 30 days"}</span><ChevronDown className="size-3 shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[state=open]:opacity-100" /></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={() => onPresetChange("all")}>All Time</DropdownMenuItem><DropdownMenuItem onClick={() => onPresetChange("15")}>Last 15 days</DropdownMenuItem><DropdownMenuItem onClick={() => onPresetChange("30")}>Last 30 days</DropdownMenuItem></DropdownMenuContent></DropdownMenu><DropdownMenu open={rangeOpen} onOpenChange={setRangeOpen}><DropdownMenuTrigger aria-label="Custom date range" className="group flex h-8 w-9 items-center gap-2 overflow-hidden rounded-full px-2 text-sm text-white/55 transition-[width,background-color] duration-200 hover:w-44 hover:bg-[#6574f5]/15 hover:text-white focus-visible:w-44 focus-visible:bg-[#6574f5]/15 data-[state=open]:w-44 data-[state=open]:bg-[#6574f5]/15"><CalendarDays className="size-4 shrink-0" /><span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-200 group-hover:max-w-32 group-hover:opacity-100 group-focus-visible:max-w-32 group-focus-visible:opacity-100 group-data-[state=open]:max-w-32 group-data-[state=open]:opacity-100">Custom date range</span></DropdownMenuTrigger><DropdownMenuContent className="w-auto p-3"><Calendar selected={dateRange} onSelect={(next) => { setDateRange(next); if (next.from && next.to) onCustomRange(next); }} numberOfMonths={2} /></DropdownMenuContent></DropdownMenu><span className="basis-full text-xs text-white/45">{currentLabel}</span></div>
}

function ComposeForm({ sending, notice, onCancel, onSend }: { sending: boolean; notice: string; onCancel: () => void; onSend: (form: HTMLFormElement) => void }) {
  const [mode, setMode] = useState<"manual" | "agent">("manual");
  return <section className="compose-card border border-white/10 shadow-2xl shadow-black/10"><div className="section-heading"><div><p className="eyebrow">NEW MESSAGE</p><h1>{mode === "agent" ? "Ask the agent to write." : "Compose with intention."}</h1></div></div><div className="compose-tabs"><button type="button" className={mode === "manual" ? "active" : ""} onClick={() => setMode("manual")}>Write myself</button><button type="button" className={mode === "agent" ? "active" : ""} onClick={() => setMode("agent")}><Sparkles size={14} /> Draft with AI</button></div>{mode === "agent" ? <AgentDraftForm onCancel={onCancel} /> : <form className="compose-form" onSubmit={(event) => { event.preventDefault(); onSend(event.currentTarget); }}><label>To<input name="to" type="email" placeholder="recipient@example.com" required /></label><label>Subject<input name="subject" placeholder="What is this about?" required /></label><label>Message<textarea name="body" placeholder="Write your message…" required /></label>{notice && <p className="form-notice">{notice}</p>}<div className="compose-actions"><button type="button" className="button button-ghost" onClick={onCancel}>Cancel</button><button type="submit" className="button button-primary" disabled={sending}>{sending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} {sending ? "Sending…" : "Send email"}</button></div></form>}</section>
}

type AgentDraft = { to: string; subject: string; body: string; assumptions: string[] };
function AgentDraftForm({ onCancel }: { onCancel: () => void }) {
  const resumeSessionId = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("resume");
  const sessionId = useRef(resumeSessionId && /^[0-9a-f-]{36}$/i.test(resumeSessionId) ? resumeSessionId : crypto.randomUUID());
  const previousUuid = useRef<string | null>(null);
  const draftUuid = useRef<string | null>(null);
  const [request, setRequest] = useState("");
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [draftToken, setDraftToken] = useState("");
  const [clarification, setClarification] = useState("");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);
  const [sent, setSent] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [edited, setEdited] = useState(false);
  const [context, setContext] = useState("");
  useEffect(() => {
    if (!resumeSessionId) return;
    const timer = window.setTimeout(() => {
      void fetch(`/api/conversations/${resumeSessionId}?limit=15&page=0`)
        .then(async (response) => response.ok ? await response.json() as { events?: Array<{ log?: { type?: string; message?: { content?: unknown } } }> } : null)
        .then((data) => {
          if (!data?.events) return;
          setContext(data.events.map((event) => {
            const content = event.log?.message?.content;
            return `${event.log?.type === "assistant" ? "Assistant" : "User"}: ${typeof content === "string" ? content : JSON.stringify(content)}`;
          }).join("\n"));
        })
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resumeSessionId]);
  const saveLog = async (type: "user" | "assistant", content: string | Record<string, unknown>) => { const uuid = await appendConversationLog({ type, sessionId: sessionId.current, parentUuid: previousUuid.current, content }); if (uuid) previousUuid.current = uuid; return uuid; };
  const createDraft = async () => { setWorking(true); setStatus(""); setClarification(""); draftUuid.current = null; await saveLog("user", request); try { const response = await fetch("/api/agent/draft", { method: "POST", headers: { "Content-Type": "application/json", "X-Conversation-Session": sessionId.current }, body: JSON.stringify({ request, context }) }); const data = await response.json() as { draft?: AgentDraft; draftToken?: string; clarification?: string; error?: string }; if (!response.ok) throw new Error(data.error); if (data.clarification) { setClarification(data.clarification); await saveLog("assistant", data.clarification); } else if (data.draft && data.draftToken) { setDraft(data.draft); setDraftToken(data.draftToken); setEdited(false); setSent(false); setIdempotencyKey(""); draftUuid.current = await saveLog("assistant", { event: "email_draft", draft: data.draft, requiresConfirmation: true }); } } catch (caught) { const message = caught instanceof Error ? caught.message : "We couldn't create a draft."; setStatus(message); await saveLog("assistant", message); } finally { setWorking(false); } };
  const sendDraft = async () => { if (!draft || !draftToken) return; setWorking(true); setStatus(""); const key = idempotencyKey || crypto.randomUUID(); setIdempotencyKey(key); try { const response = await fetch("/api/agent/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, draftToken, idempotencyKey: key }) }); const data = await response.json() as { error?: string }; if (!response.ok) throw new Error(data.error); setSent(true); setStatus("Email sent successfully."); await saveLog("assistant", { event: "email_sent", draftUuid: draftUuid.current, idempotencyKey: key, message: `Email sent successfully to ${draft.to}.` }); } catch (caught) { const errorMessage = caught instanceof Error ? caught.message : "We couldn't send the email. Your draft is preserved."; setStatus(errorMessage); await saveLog("assistant", `Email send failed for ${draft.to}: ${errorMessage}`); } finally { setWorking(false); } };
  const markEdited = () => { setEdited(true); setSent(false); setStatus("Draft changed. Create a new draft before sending."); };
  const resetDraft = () => { setDraft(null); setDraftToken(""); draftUuid.current = null; setEdited(false); setSent(false); setStatus(""); setIdempotencyKey(""); };
  return <div className="agent-compose"><BubbleGroup className="conversation-preview">{request && <Bubble align="end"><BubbleContent className="bg-[#6574f5] text-white">{request}</BubbleContent></Bubble>}{working && <Shimmer>Generating response…</Shimmer>}</BubbleGroup><label>What should the email say?<textarea value={request} onChange={(event) => { setRequest(event.target.value); resetDraft(); setClarification(""); }} placeholder="Write to alex@example.com thanking them for the introduction. Keep it warm and concise." required /></label>{clarification && <div className="agent-clarification"><Sparkles size={15} /><span>{clarification}</span></div>}{draft && <div className="agent-draft"><div className="agent-draft-label"><Sparkles size={14} /> Review AI draft before sending</div><label>To<input value={draft.to} onChange={(event) => { setDraft({ ...draft, to: event.target.value }); markEdited(); }} /></label><label>Subject<input value={draft.subject} onChange={(event) => { setDraft({ ...draft, subject: event.target.value }); markEdited(); }} /></label><label>Message<textarea value={draft.body} onChange={(event) => { setDraft({ ...draft, body: event.target.value }); markEdited(); }} /></label>{draft.assumptions.length > 0 && <div className="agent-assumptions"><strong>Assumptions to review</strong><ul>{draft.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></div>}{edited && <p className="agent-clarification">This reviewed version changed. Create a new draft to refresh the confirmation.</p>}{!sent && <button type="button" className="button button-primary" onClick={() => void sendDraft()} disabled={working || edited || !draftToken || !draft.to || !draft.subject || !draft.body}>{working ? <><LoaderCircle className="spin" size={16} /> Sending…</> : <><Send size={16} /> Send reviewed email</>}</button>}{edited && <button type="button" className="button button-ghost" onClick={() => void createDraft()} disabled={working || !request.trim()}>{working ? "Writing…" : "Create new draft"}</button>}</div>}{status && <p className="form-notice">{status}</p>}<div className="compose-actions"><button type="button" className="button button-ghost" onClick={onCancel}>Cancel</button>{!draft && <button type="button" className="button button-primary" onClick={() => void createDraft()} disabled={working || !request.trim()}>{working ? <><LoaderCircle className="spin" size={16} /> Writing…</> : <><Sparkles size={16} /> Create draft</>}</button>}</div></div>
}

function Reader({ message, accessGuard, contentScan, onGrantAccess, onRetryAssessment, onKeepClosed, summary, summarizing, onSummarize }: { message: Message; accessGuard: AccessGuard | null; contentScan: ContentScan | null; onGrantAccess: () => void; onRetryAssessment: () => void; onKeepClosed: () => void; summary: string; summarizing: boolean; onSummarize: () => void }) {
  const phishing = accessGuard?.phishing;
  return <article className="message-reader"><div className="reader-kicker"><span className="eyebrow">MESSAGE</span><span className="reader-date">{formatDate(message.receivedAt)}</span></div><h1>{message.subject}</h1><div className="reader-meta"><span className="reader-avatar">{initial(message.sender)}</span><div><strong>{message.sender || "Unknown sender"}</strong><span>to {message.recipients || "you"}</span></div><time>{message.receivedAt}</time></div>{accessGuard ? <div className="agent-clarification" role="alert"><Sparkles size={18} /><div><strong>{phishing?.risk_level === "high_risk" ? "High phishing risk detected" : phishing?.risk_level === "needs_attention" ? "This message needs attention" : phishing?.risk_level === "unable_to_verify" ? "Message security could not be verified" : "Permission required before opening"}</strong><p>{accessGuard.warning}</p>{phishing?.reasons.length ? <ul>{phishing.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}<p>This only uses the message envelope. The body, attachments, and images remain closed until you approve access.</p><div className="compose-actions"><button type="button" className="button button-primary" onClick={onGrantAccess}>Open message</button><button type="button" className="button button-ghost" onClick={onKeepClosed}>Keep closed</button></div></div></div> : <>{contentScan?.reasons.length ? <div className="agent-clarification" role="alert"><Sparkles size={18} /><div><strong>{contentScan.riskLevel === "high_risk" ? "High-risk indicators found" : "Message needs attention"}</strong><p>The full message was scanned after you opened it. Suspicious links remain blocked until you choose them individually.</p><ul>{contentScan.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>{contentScan.suspiciousLinks.length ? <div className="compose-actions">{contentScan.suspiciousLinks.map((url) => <button key={url} type="button" className="button button-ghost" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>Open link</button>)}</div> : null}</div></div> : null}<div className="email-body">{message.body === undefined ? <span className="loading-line"><LoaderCircle className="spin" size={17}/> Loading email…</span> : message.bodyHtml ? <iframe className="email-frame" title="Email content" sandbox="" srcDoc={emailDocument(message.bodyHtml, contentScan?.suspiciousLinks ?? [])} /> : <div className="plain-email">{message.bodyText || message.body || message.snippet}</div>}</div></>} {!accessGuard && <section className="summary-card"><div className="summary-content"><div className="summary-heading"><div><p className="eyebrow"><Sparkles size={13}/> AI EMAIL BRIEF</p><h2>{summary ? "Everything you need, at a glance." : "Turn this email into a decision-ready brief."}</h2></div>{summary && <span className="summary-badge">Generated</span>}</div>{summary ? <div className="summary-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={summaryMarkdownComponents}>{summary}</ReactMarkdown></div> : <p className="summary-placeholder">Get the context, important details, next step, and relevant terms in a concise, polished format.</p>}</div><div className="summary-actions"><button className="button button-primary" onClick={onSummarize} disabled={summarizing || message.body === undefined}>{summarizing ? <LoaderCircle className="spin" size={16}/> : <Sparkles size={16}/>} {summarizing ? "Building brief…" : summary ? "Refresh brief" : "Create brief"}</button><span>Grounded in this email</span></div></section>}</article>
}

function SkeletonRows() { return <div className="skeleton-rows">{Array.from({ length: 6 }, (_, index) => <div className="skeleton-row" key={index}><i/><span><b/><em/></span></div>)}</div> }
