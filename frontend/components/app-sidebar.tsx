"use client"

import { useEffect, useRef, useState } from "react"
import { FilePenLine, History, Mail, RefreshCw } from "lucide-react"
import Link from "next/link"
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInput } from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"
import { ThemeToggle } from "@/components/theme-toggle"

type User = { name?: string | null; email?: string | null; image?: string | null }
type Message = { id: string; sender: string; recipients: string; subject: string; receivedAt: string; snippet: string; isUnread: boolean }

const formatDate = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date) }
const initial = (value?: string | null) => value?.slice(0, 1).toUpperCase() || "U"
const highlight = (value: string, query: string) => {
  if (!query.trim()) return value
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return value.split(new RegExp(`(${escaped})`, "ig")).map((part, index) => part.toLowerCase() === query.trim().toLowerCase() ? <mark key={`${part}-${index}`} className="search-highlight">{part}</mark> : part)
}

export function AppSidebar({ user, view, messages, selectedId, unreadCount, hasMore, loadingMore, searching, pageError, onSearch, onLoadMore, onRetryPage, onViewChange, onSelectMessage, onRefresh }: { user: User; view: "inbox" | "compose"; messages: Message[]; selectedId?: string; unreadCount: number; hasMore: boolean; loadingMore: boolean; searching: boolean; pageError: string; onSearch: (query: string) => void; onLoadMore: () => void; onRetryPage: () => void; onViewChange: (view: "inbox" | "compose") => void; onSelectMessage: (message: Message) => void; onRefresh: () => void }) {
  const [query, setQuery] = useState("")
  const firstSearch = useRef(true)
  // Debounce only on query changes; the parent callback is recreated with dashboard renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (firstSearch.current) { firstSearch.current = false; return } const timer = window.setTimeout(() => onSearch(query), 300); return () => window.clearTimeout(timer) }, [query])
  const filteredMessages = messages
  return <Sidebar collapsible="offcanvas" className="border-r border-white/15 bg-[#18181f]">
    <SidebarHeader className="gap-4 border-b border-white/15 p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#6574f5] text-white shadow-[0_0_24px_rgba(101,116,245,.3)]"><Mail className="size-5" /></span>
        <div className="min-w-0 flex-1"><p className="text-base font-semibold text-white">Inbox</p><p className="text-xs text-white/50">{messages.length} recent messages</p></div>
        <span className="shrink-0 text-xs text-white/50">{unreadCount} unread</span>
      </div>
      <div className="flex justify-end"><ThemeToggle /></div>
      <div className="flex items-center gap-2">
        <button className={`flex h-10 min-w-0 flex-[0.8] items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors ${view === "compose" ? "bg-[#6574f5] text-white" : "bg-white/10 text-white hover:bg-white/15"}`} onClick={() => onViewChange("compose")}><FilePenLine className="size-3.5 shrink-0" />New email</button>
        <Link href="/dashboard/history" className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white" aria-label="Conversation history" title="Conversation history"><History className="size-3.5" />AI History</Link>
        <button className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white" onClick={onRefresh} aria-label="Refresh inbox" title="Refresh inbox"><RefreshCw className="size-3.5" />Refresh</button>
      </div>
      <SidebarInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search messages..." className="h-10 border-white/15 bg-white/7 px-3 text-sm" aria-label="Search messages" />
    </SidebarHeader>
    <SidebarContent className="inbox-scroll-area">
      <SidebarGroup className="min-w-0 px-0"><SidebarGroupLabel className="flex items-center gap-2 px-5 pt-3 text-[10px] uppercase tracking-[.18em] text-white/45">{searching && query.trim() ? <><Spinner /> Searching all mail…</> : query.trim() ? `${filteredMessages.length} matching messages` : "Messages"}</SidebarGroupLabel><SidebarGroupContent className="min-w-0">{messages.length === 0 ? <p className="px-5 py-8 text-center text-xs leading-5 text-white/40">{searching && query.trim() ? "Searching all mail…" : "Your inbox is clear."}</p> : filteredMessages.length === 0 ? <p className="px-5 py-8 text-center text-xs leading-5 text-white/40">No messages match “{query}”.</p> : filteredMessages.map((message) => <button key={message.id} onClick={() => onSelectMessage(message)} className={`flex w-full min-w-0 flex-col items-start gap-2.5 overflow-hidden border-b border-white/10 px-5 py-4 text-left text-sm leading-tight transition-colors hover:bg-white/8 ${selectedId === message.id ? "bg-white/12" : ""}`}><div className="flex w-full min-w-0 items-center gap-2.5"><span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${message.isUnread ? "bg-[#6574f5] text-white" : "bg-white/10 text-white/60"}`}>{initial(message.sender)}</span><span className={`min-w-0 flex-1 truncate ${message.isUnread ? "font-semibold text-white" : "text-white/75"}`}>{highlight(message.sender || "Unknown sender", query)}</span><span className="shrink-0 text-[11px] text-white/45">{formatDate(message.receivedAt)}</span></div><span className={`w-full min-w-0 truncate pl-9 ${message.isUnread ? "font-medium text-white/95" : "text-white/70"}`}>{highlight(message.subject, query)}</span><span className="line-clamp-2 w-full min-w-0 pl-9 text-xs leading-5 text-white/45">{highlight(message.snippet, query)}</span></button>)}{pageError && <div className="border-b border-white/10 px-5 py-3 text-xs text-red-200/80"><p className="mb-2">This page could not be loaded.</p><button type="button" className="text-[#aeb8ff] underline underline-offset-2" onClick={onRetryPage}>Retry</button></div>}{hasMore && <button type="button" className="m-4 flex h-9 w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-lg bg-white/8 text-xs font-medium text-white/70 hover:bg-white/12 hover:text-white" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? <><Spinner /> Loading more messages…</> : "Load more messages"}</button>}</SidebarGroupContent></SidebarGroup>
    </SidebarContent>
  </Sidebar>
}
