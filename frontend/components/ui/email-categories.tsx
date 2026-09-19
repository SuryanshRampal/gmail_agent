"use client"

import { useMemo, useState } from "react"
import { Archive, Inbox, MailX, SendHorizontal, SquarePen, Star, Trash } from "lucide-react"

type FolderType = "inbox" | "sent" | "drafts" | "trash" | "spam" | "starred" | "archive"
type Icon = typeof Inbox

interface CategoriesSectionProps {
  selectedFolder?: FolderType
  onCategoryClick?: (folderType: FolderType) => void
  systemUnreadCounts?: Partial<Record<Uppercase<FolderType> | "DRAFT", number>>
}

const folders: Array<{ name: string; folderType: FolderType; label: Uppercase<FolderType> | "DRAFT"; icon: Icon }> = [
  { name: "Inbox", folderType: "inbox", label: "INBOX", icon: Inbox },
  { name: "Sent", folderType: "sent", label: "SENT", icon: SendHorizontal },
  { name: "Drafts", folderType: "drafts", label: "DRAFT", icon: SquarePen },
  { name: "Starred", folderType: "starred", label: "STARRED", icon: Star },
  { name: "Archive", folderType: "archive", label: "ARCHIVE", icon: Archive },
  { name: "Spam", folderType: "spam", label: "SPAM", icon: MailX },
  { name: "Trash", folderType: "trash", label: "TRASH", icon: Trash },
]

export default function CategoriesSection({ selectedFolder: controlledFolder, onCategoryClick, systemUnreadCounts = {} }: CategoriesSectionProps) {
  const [uncontrolledFolder, setUncontrolledFolder] = useState<FolderType>("inbox")
  const selectedFolder = controlledFolder ?? uncontrolledFolder
  const categories = useMemo(() => folders.map((folder) => ({ ...folder, unreadCount: systemUnreadCounts[folder.label] ?? 0 })), [systemUnreadCounts])
  return <section className="px-3 py-4"><p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[.18em] text-white/45">Categories</p><div className="space-y-1">{categories.map((folder) => { const Icon = folder.icon; const active = selectedFolder === folder.folderType; return <button key={folder.folderType} type="button" onClick={() => { setUncontrolledFolder(folder.folderType); onCategoryClick?.(folder.folderType) }} className={`group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors ${active ? "bg-[#6574f5]/18 text-white" : "text-white/60 hover:bg-white/8 hover:text-white"}`}><span className="flex min-w-0 items-center gap-2.5"><Icon className={`size-4 shrink-0 transition-transform duration-200 group-hover:-rotate-12 ${active ? "text-[#aeb8ff]" : "text-white/45"}`} /><span className="truncate">{folder.name}</span></span>{folder.unreadCount > 0 && <span className="min-w-5 rounded-full bg-[#6574f5]/20 px-1.5 py-0.5 text-center text-[10px] font-medium text-[#c8cfff]">{folder.unreadCount > 99 ? "99+" : folder.unreadCount}</span>}</button> })}</div></section>
}
