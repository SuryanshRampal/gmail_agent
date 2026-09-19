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
  const sidebarActionClass = "box-border flex h-10 w-full appearance-none items-center gap-2 rounded-lg border-0 bg-transparent px-3 font-sans text-[13px] font-normal leading-5 text-white/60 transition-colors hover:bg-white/8 hover:text-white"

  return <Sidebar collapsible="offcanvas" className="border-r border-white/10 bg-[#18181f]">
    <SidebarHeader className="gap-4 border-b border-white/10 p-5">
      <button className={`flex h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${view === "compose" ? "bg-[#6574f5] text-white" : "bg-white/10 text-white hover:bg-white/15"}`} onClick={() => onViewChange("compose")}><FilePenLine className="size-4" />New email</button>
      <div className="flex h-9 items-center justify-end rounded-lg border border-white/10 bg-white/[.03] px-3"><ThemeToggle /></div>
    </SidebarHeader>
    <SidebarContent className="inbox-scroll-area">
      <CategoriesSection selectedFolder={folder} systemUnreadCounts={{ INBOX: unreadCount }} onCategoryClick={(next) => { onViewChange("inbox"); onFolderChange(next) }} />
      <div className="mx-3 border-t border-white/10 pt-3">
        <button type="button" className={sidebarActionClass} onClick={() => router.push("/dashboard/history")}><History className="size-4 shrink-0" strokeWidth={2} /><span>History</span></button>
        <button type="button" className={sidebarActionClass} onClick={onRefresh}><RefreshCw className="size-4 shrink-0" strokeWidth={2} /><span>Refresh Mailbox</span></button>
      </div>
    </SidebarContent>
    <SidebarFooter className="border-t border-white/10 p-4"><NavUser user={{ name: user.name ?? "User", email: user.email ?? "", avatar: user.image ?? "" }} /></SidebarFooter>
  </Sidebar>
}
