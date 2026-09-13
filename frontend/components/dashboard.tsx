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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, type DateRange } from "@/components/ui/calendar";
import { resolveDateRange, toGmailBoundary, type RangeMode } from "@/lib/date-range";

type Message = { id: string; sender: string; recipients: string; subject: string; receivedAt: string; snippet: string; isUnread: boolean; body?: string; bodyHtml?: string; bodyText?: string };
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
  const [loadingMore, setLoadingMore] = useState(false);
  const requestNumber = useRef(0);

  const loadMessages = async (mode: RangeMode = rangeMode, range: DateRange = dateRange, append = false, continuation?: string) => { const currentRequest = ++requestNumber.current; if (append) setLoadingMore(true); else setLoading(true); setPageError(""); if (!append) setError(""); try { const resolved = resolveDateRange(mode, range); if (!resolved) return; const params = new URLSearchParams({ mode, from: toGmailBoundary(resolved.from, true), to: toGmailBoundary(resolved.to), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }); if (continuation) params.set("pageToken", continuation); const response = await fetch(`/api/gmail/messages?${params.toString()}`); const data = await response.json() as { messages?: Message[]; nextPageToken?: string; resultSizeEstimate?: number; error?: string }; if (!response.ok) throw new Error(data.error); if (currentRequest !== requestNumber.current) return; setMessages((existing) => append ? [...existing, ...(data.messages ?? [])] : (data.messages ?? [])); setNextPageToken(data.nextPageToken); if (!append) { setSelected(null); setSummary(""); } } catch (caught) { if (currentRequest !== requestNumber.current) return; const message = caught instanceof Error ? caught.message : "We couldn't access this Gmail page right now. Please try again."; if (append) setPageError(message); else setError(message); } finally { if (currentRequest === requestNumber.current) { if (append) setLoadingMore(false); else setLoading(false); } } };
  // The initial request intentionally uses the default range captured on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timer = window.setTimeout(() => { void loadMessages("recent"); }, 0); return () => window.clearTimeout(timer); }, []);
  const openEmail = async (message: Message) => { setView("inbox"); setSelected({ ...message, body: undefined }); setSummary(""); try { const response = await fetch(`/api/gmail/messages/${message.id}`); const data = await response.json(); if (!response.ok) throw new Error(data.error); setSelected(data); } catch (caught) { setError(caught instanceof Error ? caught.message : "We couldn't access this email."); } };
  const generateSummary = async () => { if (!selected) return; setSummarizing(true); setSummary(""); try { const response = await fetch(`/api/gmail/messages/${selected.id}/summary`, { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setSummary(data.summary); } catch (caught) { setSummary(caught instanceof Error ? caught.message : "We couldn't generate a summary for this email. Please try again."); } finally { setSummarizing(false); } };
  const send = async (form: HTMLFormElement) => { const values = new FormData(form); setSending(true); setNotice(""); try { const response = await fetch("/api/gmail/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: values.get("to"), subject: values.get("subject"), body: values.get("body") }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); form.reset(); setNotice("Email sent successfully."); } catch (caught) { setNotice(caught instanceof Error ? caught.message : "We couldn't send the email. Please try again."); } finally { setSending(false); } };

  const visibleMessages = messages;
  const rangeLabel = rangeMode === "recent" ? "Last 30 days" : rangeMode === "date" ? shortDate(dateRange.from) : dateRange.from && dateRange.to ? `${shortDate(dateRange.from)} – ${shortDate(dateRange.to)}` : "Choose date range";
  return <SidebarProvider defaultOpen style={{ "--sidebar-width": "clamp(28rem, 30vw, 32rem)" } as React.CSSProperties}><AppSidebar user={user} view={view} messages={visibleMessages} selectedId={selected?.id} unreadCount={visibleMessages.filter((message) => message.isUnread).length} hasMore={Boolean(nextPageToken)} loadingMore={loadingMore} pageError={pageError} onLoadMore={() => { if (nextPageToken) void loadMessages(rangeMode, dateRange, true, nextPageToken); }} onRetryPage={() => { if (nextPageToken) void loadMessages(rangeMode, dateRange, true, nextPageToken); }} onViewChange={(nextView) => { setView(nextView); if (nextView === "compose") setSelected(null); }} onSelectMessage={(message) => void openEmail(message)} onRefresh={() => void loadMessages()} /><SidebarInset className="min-w-0 bg-[#171721]"><header className="sticky top-0 z-10 flex min-h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-[#171721]/90 px-5 py-3 backdrop-blur-xl md:px-8"><SidebarTrigger className="text-white/60 hover:bg-white/8 hover:text-white" /><Separator orientation="vertical" className="h-5 bg-white/15" /><div className="min-w-0 flex-1"><p className="text-xs font-medium uppercase tracking-[.18em] text-white/35">{view === "compose" ? "New message" : "Inbox"}</p>{view === "compose" ? <p className="text-sm text-white/75">Write to someone</p> : <div className="relative"><Tabs value={rangeMode} onValueChange={(value) => { const next = value as RangeMode; setRangeMode(next); if (next === "recent") void loadMessages("recent"); else { setMessages([]); setNextPageToken(undefined); setRangeOpen(true); } }}><TabsList><TabsTrigger value="recent">Last 30 days</TabsTrigger><TabsTrigger value="date"><CalendarDays className="mr-1 inline size-3" />Custom date</TabsTrigger><TabsTrigger value="period"><CalendarDays className="mr-1 inline size-3" />Custom period</TabsTrigger></TabsList></Tabs>{rangeMode !== "recent" && rangeOpen && <div className="absolute left-0 top-full z-20 mt-3"><div className="rounded-xl border border-white/10 bg-[#20202c] p-3 shadow-2xl"><div className="mb-2 flex items-center justify-between gap-5"><span className="text-xs font-medium text-white/75">{rangeMode === "date" ? "Pick a date" : "Pick a period"}</span><button type="button" className="text-white/40 hover:text-white" onClick={() => setRangeOpen(false)} aria-label="Close date picker">×</button></div><Calendar selected={rangeMode === "date" ? { from: dateRange.from } : dateRange} onSelect={(next) => { const updated = rangeMode === "date" ? { from: next.from, to: next.from } : next; setDateRange(updated); if (rangeMode === "date" ? next.from : next.from && next.to) { setRangeOpen(false); void loadMessages(rangeMode, updated); } }} numberOfMonths={rangeMode === "date" ? 1 : 2} /></div></div>}<button type="button" className="mt-1 flex items-center gap-1 text-[11px] text-white/40 hover:text-white/65" onClick={() => setRangeOpen((open) => !open)}><span>{rangeLabel}</span><ChevronDown className="size-3" /></button></div>}</div><NavUser placement="header" user={{ name: user.name ?? "User", email: user.email ?? "", avatar: user.image ?? "" }} /></header><main className="mx-auto w-full max-w-[90rem] flex-1 p-4 md:p-6 lg:p-8">{view === "compose" ? <ComposeForm sending={sending} notice={notice} onCancel={() => setView("inbox")} onSend={send} /> : error ? <div className="error-card"><p>{error}</p>{error.includes("connection") && <button className="button button-primary" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>Reconnect Gmail</button>}</div> : loading ? <SkeletonRows /> : selected ? <Reader message={selected} summary={summary} summarizing={summarizing} onSummarize={() => void generateSummary()} /> : <div className="empty-state"><Mail size={26}/><h2>{visibleMessages.length ? "Select a message" : "No messages in this range"}</h2><p>{visibleMessages.length ? "Choose an email from your inbox to read it here." : "Try another date range to see more of your inbox."}</p></div>}</main></SidebarInset></SidebarProvider>;
}

function ComposeForm({ sending, notice, onCancel, onSend }: { sending: boolean; notice: string; onCancel: () => void; onSend: (form: HTMLFormElement) => void }) { return <section className="compose-card border border-white/10 shadow-2xl shadow-black/10"><div className="section-heading"><div><p className="eyebrow">NEW MESSAGE</p><h1>Compose with intention.</h1></div></div><form className="compose-form" onSubmit={(event) => { event.preventDefault(); onSend(event.currentTarget); }}><label>To<input name="to" type="email" placeholder="recipient@example.com" required /></label><label>Subject<input name="subject" placeholder="What is this about?" required /></label><label>Message<textarea name="body" placeholder="Write your message…" required /></label>{notice && <p className="form-notice">{notice}</p>}<div className="compose-actions"><button type="button" className="button button-ghost" onClick={onCancel}>Cancel</button><button type="submit" className="button button-primary" disabled={sending}>{sending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} {sending ? "Sending…" : "Send email"}</button></div></form></section> }

function Reader({ message, summary, summarizing, onSummarize }: { message: Message; summary: string; summarizing: boolean; onSummarize: () => void }) { return <article className="message-reader"><div className="reader-kicker"><span className="eyebrow">MESSAGE</span><span className="reader-date">{formatDate(message.receivedAt)}</span></div><h1>{message.subject}</h1><div className="reader-meta"><span className="reader-avatar">{initial(message.sender)}</span><div><strong>{message.sender || "Unknown sender"}</strong><span>to {message.recipients || "you"}</span></div><time>{message.receivedAt}</time></div><div className="email-body">{message.body === undefined ? <span className="loading-line"><LoaderCircle className="spin" size={17}/> Loading email…</span> : message.bodyHtml ? <iframe className="email-frame" title="Email content" sandbox="" srcDoc={emailDocument(message.bodyHtml)} /> : <div className="plain-email">{message.bodyText || message.body || message.snippet}</div>}</div><section className="summary-card"><div className="summary-content"><div className="summary-heading"><div><p className="eyebrow"><Sparkles size={13}/> AI EMAIL BRIEF</p><h2>{summary ? "Everything you need, at a glance." : "Turn this email into a decision-ready brief."}</h2></div>{summary && <span className="summary-badge">Generated</span>}</div>{summary ? <div className="summary-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={summaryMarkdownComponents}>{summary}</ReactMarkdown></div> : <p className="summary-placeholder">Get the context, important details, next step, and relevant terms in a concise, polished format.</p>}</div><div className="summary-actions"><button className="button button-primary" onClick={onSummarize} disabled={summarizing || message.body === undefined}>{summarizing ? <LoaderCircle className="spin" size={16}/> : <Sparkles size={16}/>} {summarizing ? "Building brief…" : summary ? "Refresh brief" : "Create brief"}</button><span>Grounded in this email</span></div></section></article> }

function SkeletonRows() { return <div className="skeleton-rows">{Array.from({ length: 6 }, (_, index) => <div className="skeleton-row" key={index}><i/><span><b/><em/></span></div>)}</div> }
