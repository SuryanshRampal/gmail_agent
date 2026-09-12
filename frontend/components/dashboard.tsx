"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { LoaderCircle, Mail, Send, Sparkles } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

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

  const loadMessages = async () => { setLoading(true); setError(""); try { const response = await fetch("/api/gmail/messages"); const data = await response.json(); if (!response.ok) throw new Error(data.error); setMessages(data); } catch (caught) { setError(caught instanceof Error ? caught.message : "We couldn't access your Gmail right now. Please try again."); } finally { setLoading(false); } };
  useEffect(() => { const timer = window.setTimeout(() => { void loadMessages(); }, 0); return () => window.clearTimeout(timer); }, []);
  const openEmail = async (message: Message) => { setView("inbox"); setSelected({ ...message, body: undefined }); setSummary(""); try { const response = await fetch(`/api/gmail/messages/${message.id}`); const data = await response.json(); if (!response.ok) throw new Error(data.error); setSelected(data); } catch (caught) { setError(caught instanceof Error ? caught.message : "We couldn't access this email."); } };
  const generateSummary = async () => { if (!selected) return; setSummarizing(true); setSummary(""); try { const response = await fetch(`/api/gmail/messages/${selected.id}/summary`, { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setSummary(data.summary); } catch (caught) { setSummary(caught instanceof Error ? caught.message : "We couldn't generate a summary for this email. Please try again."); } finally { setSummarizing(false); } };
  const send = async (form: HTMLFormElement) => { const values = new FormData(form); setSending(true); setNotice(""); try { const response = await fetch("/api/gmail/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: values.get("to"), subject: values.get("subject"), body: values.get("body") }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); form.reset(); setNotice("Email sent successfully."); } catch (caught) { setNotice(caught instanceof Error ? caught.message : "We couldn't send the email. Please try again."); } finally { setSending(false); } };

  const unreadCount = messages.filter((message) => message.isUnread).length;
  return <SidebarProvider defaultOpen style={{ "--sidebar-width": "clamp(28rem, 30vw, 32rem)" } as React.CSSProperties}><AppSidebar user={user} view={view} messages={messages} selectedId={selected?.id} unreadCount={unreadCount} onViewChange={(nextView) => { setView(nextView); if (nextView === "compose") setSelected(null); }} onSelectMessage={(message) => void openEmail(message)} onRefresh={() => void loadMessages()} /><SidebarInset className="min-w-0 bg-[#171721]"><header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-[#171721]/90 px-5 backdrop-blur-xl md:px-8"><SidebarTrigger className="text-white/60 hover:bg-white/8 hover:text-white" /><Separator orientation="vertical" className="h-5 bg-white/15" /><div><p className="text-xs font-medium uppercase tracking-[.18em] text-white/35">{view === "compose" ? "New message" : "Inbox"}</p><p className="text-sm text-white/75">{view === "compose" ? "Write to someone" : `${messages.length} recent messages`}</p></div><span className="ml-auto hidden text-sm text-white/45 sm:inline">{user.email}</span><span className="flex size-8 items-center justify-center rounded-full bg-white/10 text-sm font-medium text-white">{initial(user.name)}</span></header><main className="mx-auto w-full max-w-[90rem] flex-1 p-4 md:p-6 lg:p-8">{view === "compose" ? <ComposeForm sending={sending} notice={notice} onCancel={() => setView("inbox")} onSend={send} /> : error ? <div className="error-card"><p>{error}</p>{error.includes("connection") && <button className="button button-primary" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>Reconnect Gmail</button>}</div> : loading ? <SkeletonRows /> : selected ? <Reader message={selected} summary={summary} summarizing={summarizing} onSummarize={() => void generateSummary()} /> : <div className="empty-state"><Mail size={26}/><h2>Select a message</h2><p>Choose an email from your inbox to read it here.</p></div>}</main></SidebarInset></SidebarProvider>;
}

function ComposeForm({ sending, notice, onCancel, onSend }: { sending: boolean; notice: string; onCancel: () => void; onSend: (form: HTMLFormElement) => void }) { return <section className="compose-card border border-white/10 shadow-2xl shadow-black/10"><div className="section-heading"><div><p className="eyebrow">NEW MESSAGE</p><h1>Compose with intention.</h1></div></div><form className="compose-form" onSubmit={(event) => { event.preventDefault(); onSend(event.currentTarget); }}><label>To<input name="to" type="email" placeholder="recipient@example.com" required /></label><label>Subject<input name="subject" placeholder="What is this about?" required /></label><label>Message<textarea name="body" placeholder="Write your message…" required /></label>{notice && <p className="form-notice">{notice}</p>}<div className="compose-actions"><button type="button" className="button button-ghost" onClick={onCancel}>Cancel</button><button type="submit" className="button button-primary" disabled={sending}>{sending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} {sending ? "Sending…" : "Send email"}</button></div></form></section> }

function Reader({ message, summary, summarizing, onSummarize }: { message: Message; summary: string; summarizing: boolean; onSummarize: () => void }) { return <article className="message-reader"><div className="reader-kicker"><span className="eyebrow">MESSAGE</span><span className="reader-date">{formatDate(message.receivedAt)}</span></div><h1>{message.subject}</h1><div className="reader-meta"><span className="reader-avatar">{initial(message.sender)}</span><div><strong>{message.sender || "Unknown sender"}</strong><span>to {message.recipients || "you"}</span></div><time>{message.receivedAt}</time></div><div className="email-body">{message.body === undefined ? <span className="loading-line"><LoaderCircle className="spin" size={17}/> Loading email…</span> : message.bodyHtml ? <iframe className="email-frame" title="Email content" sandbox="" srcDoc={emailDocument(message.bodyHtml)} /> : <div className="plain-email">{message.bodyText || message.body || message.snippet}</div>}</div><section className="summary-card"><div><p className="eyebrow"><Sparkles size={13}/> AI SUMMARY</p>{summary ? <p className="summary-text">{summary}</p> : <p>Surface the main point, action items, dates, and decisions.</p>}</div><button className="button button-primary" onClick={onSummarize} disabled={summarizing || message.body === undefined}>{summarizing ? <LoaderCircle className="spin" size={16}/> : <Sparkles size={16}/>} {summarizing ? "Generating…" : "Summarize"}</button></section></article> }

function SkeletonRows() { return <div className="skeleton-rows">{Array.from({ length: 6 }, (_, index) => <div className="skeleton-row" key={index}><i/><span><b/><em/></span></div>)}</div> }
