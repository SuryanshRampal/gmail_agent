"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { ChevronsUpDownIcon, LogOutIcon, Repeat2Icon } from "lucide-react"
import { signIn, signOut } from "next-auth/react"

type Account = { name: string; email: string; avatar: string }

export function NavUser({ user, placement = "sidebar" }: { user: Account; placement?: "sidebar" | "header" }) {
  const { isMobile } = useSidebar()
  const switchAccount = async () => {
    await signOut({ redirect: false })
    await signIn("google", { callbackUrl: "/dashboard", prompt: "select_account" })
  }
  const trigger = <DropdownMenuTrigger render={placement === "header" ? <button type="button" className="flex items-center gap-3 rounded-full px-2 py-1.5 text-left transition-colors hover:bg-white/10" /> : <SidebarMenuButton size="lg" className="md:h-8 md:p-0 data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground" />}>
    <Avatar className={placement === "header" ? "h-9 w-9 rounded-full" : "h-8 w-8 rounded-lg"}><AvatarImage src={user.avatar} alt={user.name} /><AvatarFallback className="bg-white/10 text-white">{user.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
    <div className="grid min-w-0 flex-1 text-left text-sm leading-tight"><span className="truncate font-medium text-white">{user.name}</span><span className="truncate text-xs text-white/55">{user.email}</span></div>
    <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 text-white/55" />
  </DropdownMenuTrigger>
  const menu = <DropdownMenuContent className="min-w-64 rounded-lg" side={placement === "header" || isMobile ? "bottom" : "right"} align="end" sideOffset={6}>
    <DropdownMenuGroup><DropdownMenuLabel className="p-2 font-normal"><div className="flex items-center gap-2"><Avatar className="h-9 w-9 rounded-full"><AvatarImage src={user.avatar} alt={user.name} /><AvatarFallback className="bg-white/10 text-white">{user.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar><div className="grid min-w-0 text-left text-sm leading-tight"><span className="truncate font-medium">{user.name}</span><span className="truncate text-xs text-muted-foreground">{user.email}</span></div></div></DropdownMenuLabel></DropdownMenuGroup>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => void switchAccount()}><Repeat2Icon />Switch account</DropdownMenuItem>
    <DropdownMenuItem onClick={() => void signOut({ callbackUrl: "/" })}><LogOutIcon />Log out</DropdownMenuItem>
  </DropdownMenuContent>
  return placement === "header" ? <div className="ml-auto shrink-0"><DropdownMenu>{trigger}{menu}</DropdownMenu></div> : <SidebarMenu><SidebarMenuItem><DropdownMenu>{trigger}{menu}</DropdownMenu></SidebarMenuItem></SidebarMenu>
}
