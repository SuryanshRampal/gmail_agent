"use client";

import { useEffect, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { Bot, FilePenLine, Inbox, LoaderCircle, LogOut, Mail, Send, Sparkles, X } from "lucide-react";

type Message = { id: string; sender: string; recipients: string; subject: string; receivedAt: string; snippet: string; isUnread: boolean; body?: string };
type User = { name?: string | null; email?: string | null; image?: string | null };

const formatDate = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date); };
const initial = (value?: string | null) => value?.slice(0, 1).toUpperCase() || "U";

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

  const loadMessages = async () => {
    setLoading(true); setError("");
    try { const response = await fetch("/api/gmail/messages"); const data = await response.json(); if (!response.ok) throw new Error(data.error); setMessages(data); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "We couldn't access your Gmail right now. Please try again."); }
    finally { setLoading(false); }
  };
  useEffect(() => { const timer = window.setTimeout(() => { void loadMessages(); }, 0); return () => window.clearTimeout(timer); }, []);

  const openEmail = async (message: Message) => {
    setSelected({ ...message, body: undefined }); setSummary("");
    try { const response = await fetch(`/api/gmail/messages/${message.id}`); const data = await response.json(); if (!response.ok) throw new Error(data.error); setSelected(data); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "We couldn't access this email."); }
  };
  const generateSummary = async () => {
    if (!selected) return; setSummarizing(true); setSummary("");
    try { const response = await fetch(`/api/gmail/messages/${selected.id}/summary`, { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setSummary(data.summary); }
    catch (caught) { setSummary(caught instanceof Error ? caught.message : "We couldn't generate a summary for this email. Please try again."); }
    finally { setSummarizing(false); }
  };
  const send = async (form: HTMLFormElement) => {
    const values = new FormData(form); setSending(true); setNotice("");
    try { const response = await fetch("/api/gmail/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: values.get("to"), subject: values.get("subject"), body: values.get("body") }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); form.reset(); setNotice("Email sent successfully."); }
    catch (caught) { setNotice(caught instanceof Error ? caught.message : "We couldn't send the email. Please try again."); }
    finally { setSending(false); }
  };

  return <main className="app-shell">
    <header className="app-header"><div className="wordmark">Mercury <i>Mail</i></div><div className="account"><span className="account-email">{user.email}</span><span className="avatar" aria-label={user.name ?? "User"}>{initial(user.name)}</span><button className="icon-button" onClick={() => signOut({ callbackUrl: "/" })} aria-label="Sign out"><LogOut size={17} /></button></div></header>
    <div className="app-body">
      <aside className="sidebar"><button className={`nav-item ${view === "inbox" ? "active" : ""}`} onClick={() => setView("inbox")}><Inbox size={18} />Inbox</button><button className={`nav-item ${view === "compose" ? "active" : ""}`} onClick={() => { setView("compose"); setSelected(null); }}><FilePenLine size={18} />Compose</button><div className="sidebar-note"><Bot size={17}/><span>Gmail actions are secured with your Google connection.</span></div></aside>
      <section className="content">
        {view === "compose" ? <section className="compose-card"><div className="section-heading"><div><p className="eyebrow">NEW MESSAGE</p><h1>Compose with intention.</h1></div></div><form className="compose-form" onSubmit={(event) => { event.preventDefault(); void send(event.currentTarget); }}><label>To<input name="to" type="email" placeholder="recipient@example.com" required /></label><label>Subject<input name="subject" placeholder="What is this about?" required /></label><label>Message<textarea name="body" placeholder="Write your message…" required /></label>{notice && <p className="form-notice">{notice}</p>}<div className="compose-actions"><button type="button" className="button button-ghost" onClick={() => setView("inbox")}>Cancel</button><button type="submit" className="button button-primary" disabled={sending}>{sending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} {sending ? "Sending…" : "Send email"}</button></div></form></section> : <section className="inbox-panel"><div className="section-heading"><div><p className="eyebrow">GMAIL AGENT</p><h1>Your inbox, in context.</h1></div><button className="button button-ghost" onClick={() => void loadMessages()} disabled={loading}>Refresh</button></div>{error && <div className="error-card"><p>{error}</p>{error.includes("connection") ? <button className="button button-primary" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>Reconnect Gmail</button> : null}</div>}{loading ? <SkeletonRows /> : messages.length === 0 && !error ? <div className="empty-state"><Mail size={26}/><h2>Your inbox is clear.</h2><p>There are no recent messages to review.</p></div> : <div className="mail-list">{messages.map((message) => <button className={`mail-row ${message.isUnread ? "unread" : ""}`} onClick={() => void openEmail(message)} key={message.id}><span className="mail-sender">{message.sender || "Unknown sender"}</span><span className="mail-content"><strong>{message.subject}</strong><small>{message.snippet}</small></span><time>{formatDate(message.receivedAt)}</time></button>)}</div>}</section>}
      </section>
    </div>
    {selected && <div className="detail-overlay" role="dialog" aria-modal="true"><article className="detail-card"><button className="detail-close icon-button" onClick={() => setSelected(null)} aria-label="Close message"><X size={18}/></button><p className="eyebrow">MESSAGE</p><h2>{selected.subject}</h2><div className="message-meta"><span>{selected.sender}</span><span>to {selected.recipients || "you"}</span><time>{selected.receivedAt}</time></div><div className="email-body">{selected.body === undefined ? <span className="loading-line"><LoaderCircle className="spin" size={17}/> Loading email…</span> : selected.body || selected.snippet}</div><section className="summary-card"><div><p className="eyebrow"><Sparkles size={13}/> AI SUMMARY</p>{summary ? <p className="summary-text">{summary}</p> : <p>Surface the main point, action items, dates, and decisions.</p>}</div><button className="button button-primary" onClick={() => void generateSummary()} disabled={summarizing || selected.body === undefined}>{summarizing ? <LoaderCircle className="spin" size={16}/> : <Sparkles size={16}/>} {summarizing ? "Generating…" : "Summarize"}</button></section></article></div>}
  </main>;
}

function SkeletonRows() { return <div className="skeleton-rows">{Array.from({ length: 6 }, (_, index) => <div className="skeleton-row" key={index}><i/><span><b/><em/></span></div>)}</div>; }
