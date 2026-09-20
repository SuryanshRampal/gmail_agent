"use client"

import { FilePenLine, History, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { NavUser } from "@/components/nav-user"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import CategoriesSection from "@/components/ui/email-categories"

type User = { name?: string | null; email?: string | null; image?: string | null }
type Folder = "inbox" | "sent" | "drafts" | "trash" | "spam" | "starred" | "archive"

export function AppSidebar({ user, view, folder, unreadCount, onFolderChange, onViewChange, onRefresh }: { user: User; view: "inbox" | "compose"; folder: Folder; unreadCount: number; onFolderChange: (folder: Folder) => void; onViewChange: (view: "inbox" | "compose") => void; onRefresh: () => void }) {
  const router = useRouter()
  const sidebarActionClass = "box-border flex h-7 w-full appearance-none items-center gap-2.5 rounded-full border-0 bg-transparent px-2.5 font-sans text-xs font-normal leading-5 text-white/60 transition-colors hover:bg-[#6574f5]/15 hover:text-white"

  return <Sidebar collapsible="offcanvas" className="border-r border-white/10 bg-[#18181f]">
    <SidebarHeader className="gap-2.5 border-b border-white/10 p-3">
      <button className={`sidebar-compose-button flex h-8 w-full items-center justify-center gap-2 rounded-lg px-2.5 text-xs font-medium transition-colors ${view === "compose" ? "bg-[#6574f5] text-white" : "sidebar-compose-secondary bg-white/10 text-white hover:bg-white/15"}`} onClick={() => onViewChange("compose")}><FilePenLine className="size-3.5" />New email</button>
      <div className="theme-toggle-shell flex h-6 items-center justify-center rounded-xl border border-white/10 bg-[#6574f5]/30 px-2.5"><ThemeToggle /></div>
    </SidebarHeader>
    <SidebarContent className="inbox-scroll-area">
      <CategoriesSection selectedFolder={folder} systemUnreadCounts={{ INBOX: unreadCount }} onCategoryClick={(next) => { onViewChange("inbox"); onFolderChange(next) }} />
      <div className="mx-2.5 border-t border-white/10 pt-2">
        <button type="button" className={sidebarActionClass} onClick={() => router.push("/dashboard/history")}><History className="size-4 shrink-0" strokeWidth={2} /><span>History</span></button>
        <button type="button" className={sidebarActionClass} onClick={onRefresh}><RefreshCw className="size-4 shrink-0" strokeWidth={2} /><span>Refresh Mailbox</span></button>
      </div>
    </SidebarContent>
    <SidebarFooter className="border-t border-white/10 p-2.5"><NavUser user={{ name: user.name ?? "User", email: user.email ?? "", avatar: user.image ?? "" }} /></SidebarFooter>
  </Sidebar>
}
