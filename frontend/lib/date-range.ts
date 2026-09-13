export type RangeMode = "recent" | "date" | "period";
export type DateRangeValue = { from?: Date; to?: Date };
export type ResolvedDateRange = { from: Date; to: Date };

const localDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const nextDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

export function resolveDateRange(mode: RangeMode, selection: DateRangeValue = {}, now = new Date()): ResolvedDateRange | null {
  const today = localDay(now);
  if (mode === "recent") {
    return { from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29), to: nextDay(today) };
  }
  if (!selection.from) return null;
  const from = localDay(selection.from);
  if (mode === "date") return { from, to: nextDay(from) };
  if (!selection.to) return null;
  const end = localDay(selection.to < from ? from : selection.to);
  return { from, to: nextDay(end) };
}

export function toGmailBoundary(date: Date, inclusive = false): string {
  const seconds = Math.floor(date.getTime() / 1000) - (inclusive ? 1 : 0);
  return String(seconds);
}
