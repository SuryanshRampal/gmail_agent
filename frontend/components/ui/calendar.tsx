"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "cn"

export type DateRange = { from?: Date; to?: Date }
const sameDay = (a?: Date, b?: Date) => !!a && !!b && a.toDateString() === b.toDateString()
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)
const monthLabel = (date: Date) => new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date)
const key = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

export function Calendar({ selected, onSelect, numberOfMonths = 2, className }: { selected?: DateRange; onSelect: (range: DateRange) => void; numberOfMonths?: number; className?: string }) {
  const [month, setMonth] = React.useState(startOfMonth(selected?.from ?? new Date()))
  const months = Array.from({ length: numberOfMonths }, (_, index) => new Date(month.getFullYear(), month.getMonth() + index, 1))
  const choose = (date: Date) => {
    if (!selected?.from || selected.to || date < selected.from) onSelect({ from: date })
    else onSelect({ from: selected.from, to: date })
  }
  return <div className={cn("w-fit rounded-xl border border-white/10 bg-[#20202c] p-3 text-white", className)}>
    <div className="mb-2 flex items-center justify-between"><button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"><ChevronLeft size={15} /></button><span className="text-xs font-medium text-white/80">{monthLabel(month)}{numberOfMonths > 1 ? ` – ${monthLabel(months[months.length - 1])}` : ""}</span><button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"><ChevronRight size={15} /></button></div>
    <div className="flex gap-4">{months.map((current) => { const first = current.getDay(); const days = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate(); return <div key={key(current)} className="w-[204px]"><div className="mb-1 grid grid-cols-7 text-center text-[10px] text-white/35">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day}>{day}</span>)}</div><div className="grid grid-cols-7 gap-y-1 text-center text-[11px]">{Array.from({ length: first + days }, (_, index) => { if (index < first) return <span key={`empty-${index}`} />; const date = new Date(current.getFullYear(), current.getMonth(), index - first + 1); const inRange = !!selected?.from && !!selected?.to && date >= selected.from && date <= selected.to; const active = sameDay(date, selected?.from) || sameDay(date, selected?.to); return <button type="button" key={key(date)} onClick={() => choose(date)} className={cn("mx-auto flex size-6 items-center justify-center rounded-md text-white/70 hover:bg-[#6574f5]/40", inRange && "rounded-none bg-[#6574f5]/20 text-white", active && "rounded-md bg-[#6574f5] font-semibold text-white")}>{date.getDate()}</button> })}</div></div> })}</div>
    <p className="mt-3 border-t border-white/10 pt-2 text-[10px] text-white/40">Select a start date, then an end date.</p>
  </div>
}
