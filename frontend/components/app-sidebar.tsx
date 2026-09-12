"use client"

import { FilePenLine, Mail, RefreshCw } from "lucide-react"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInput } from "@/components/ui/sidebar"
import { NavUser } from "@/components/nav-user"

type User = { name?: string | null; email?: string | null; image?: string | null }
type Message = { id: string; sender: string; recipients: string; subject: string; receivedAt: string; snippet: string; isUnread: boolean }

const formatDate = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date) }
const initial = (value?: string | null) => value?.slice(0, 1).toUpperCase() || "U"

export function AppSidebar({ user, view, messages, selectedId, unreadCount, onViewChange, onSelectMessage, onRefresh }: { user: User; view: "inbox" | "compose"; messages: Message[]; selectedId?: string; unreadCount: number; onViewChange: (view: "inbox" | "compose") => void; onSelectMessage: (message: Message) => void; onRefresh: () => void }) {
  return <Sidebar collapsible="offcanvas" className="border-r border-white/15 bg-[#18181f]">
    <SidebarHeader className="gap-4 border-b border-white/15 p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#6574f5] text-white shadow-[0_0_24px_rgba(101,116,245,.3)]"><Mail className="size-5" /></span>
        <div className="min-w-0 flex-1"><p className="text-base font-semibold text-white">Inbox</p><p className="text-xs text-white/50">{messages.length} recent messages</p></div>
        <span className="shrink-0 text-xs text-white/50">{unreadCount} unread</span>
      </div>
      <div className="flex items-center gap-2">
        <button className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors ${view === "compose" ? "bg-[#6574f5] text-white" : "bg-white/10 text-white hover:bg-white/15"}`} onClick={() => onViewChange("compose")}><FilePenLine className="size-4" />New email</button>
        <button className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/15 text-white/70 transition-colors hover:bg-white/10 hover:text-white" onClick={onRefresh} aria-label="Refresh inbox" title="Refresh inbox"><RefreshCw className="size-4" /></button>
      </div>
      <SidebarInput placeholder="Search messages..." className="h-10 border-white/15 bg-white/7 px-3 text-sm" />
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup className="min-w-0 px-0"><SidebarGroupLabel className="px-5 pt-3 text-[10px] uppercase tracking-[.18em] text-white/45">Messages</SidebarGroupLabel><SidebarGroupContent className="min-w-0">{messages.length === 0 ? <p className="px-5 py-8 text-center text-xs leading-5 text-white/40">Your inbox is clear.</p> : messages.map((message) => <button key={message.id} onClick={() => onSelectMessage(message)} className={`flex w-full min-w-0 flex-col items-start gap-2.5 overflow-hidden border-b border-white/10 px-5 py-4 text-left text-sm leading-tight transition-colors hover:bg-white/8 ${selectedId === message.id ? "bg-white/12" : ""}`}><div className="flex w-full min-w-0 items-center gap-2.5"><span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${message.isUnread ? "bg-[#6574f5] text-white" : "bg-white/10 text-white/60"}`}>{initial(message.sender)}</span><span className={`min-w-0 flex-1 truncate ${message.isUnread ? "font-semibold text-white" : "text-white/75"}`}>{message.sender || "Unknown sender"}</span><span className="shrink-0 text-[11px] text-white/45">{formatDate(message.receivedAt)}</span></div><span className={`w-full min-w-0 truncate pl-9 ${message.isUnread ? "font-medium text-white/95" : "text-white/70"}`}>{message.subject}</span><span className="line-clamp-2 w-full min-w-0 pl-9 text-xs leading-5 text-white/45">{message.snippet}</span></button>)}</SidebarGroupContent></SidebarGroup>
    </SidebarContent>
    <SidebarFooter className="border-t border-white/15 p-2"><NavUser user={{ name: user.name ?? "User", email: user.email ?? "", avatar: user.image ?? "" }} /></SidebarFooter>
  </Sidebar>
}
