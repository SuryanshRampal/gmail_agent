"use client"

import * as React from "react"
import { cn } from "cn"

type TabsContextValue = { value: string; onValueChange?: (value: string) => void }
const TabsContext = React.createContext<TabsContextValue | null>(null)

export function Tabs({ value, defaultValue, onValueChange, children, className }: { value?: string; defaultValue?: string; onValueChange?: (value: string) => void; children: React.ReactNode; className?: string }) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "")
  const currentValue = value ?? internalValue
  const change = (next: string) => { if (value === undefined) setInternalValue(next); onValueChange?.(next) }
  return <TabsContext.Provider value={{ value: currentValue, onValueChange: change }}><div className={className}>{children}</div></TabsContext.Provider>
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div role="tablist" className={cn("inline-flex items-center gap-1 border-b border-white/10", className)}>{children}</div>
}

export function TabsTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const context = React.useContext(TabsContext)
  const active = context?.value === value
  return <button type="button" role="tab" aria-selected={active} onClick={() => context?.onValueChange?.(value)} className={cn("relative whitespace-nowrap px-1 pb-3 pt-1 text-xs font-medium text-white/45 transition-colors hover:text-white/80", active && "text-white after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-[#6574f5]", className)}>{children}</button>
}
