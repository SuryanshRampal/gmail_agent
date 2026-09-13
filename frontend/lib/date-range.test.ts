import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's native TypeScript runner requires the .ts extension.
import { resolveDateRange, toGmailBoundary } from "./date-range.ts";

const local = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12);

test("Last 30 days includes today and the preceding 29 calendar days", () => {
  const range = resolveDateRange("recent", {}, local(2026, 9, 13));
  assert.equal(range?.from.toDateString(), local(2026, 8, 15).toDateString());
  assert.equal(range?.to.toDateString(), local(2026, 9, 14).toDateString());
});

test("custom period includes the complete final day", () => {
  const range = resolveDateRange("period", { from: local(2026, 9, 1), to: local(2026, 9, 13) });
  assert.equal(range?.from.toDateString(), local(2026, 9, 1).toDateString());
  assert.equal(range?.to.toDateString(), local(2026, 9, 14).toDateString());
  assert.equal(Number(toGmailBoundary(range!.to)) > Number(toGmailBoundary(range!.from, true)), true);
});

test("custom period crosses a year boundary", () => {
  const range = resolveDateRange("period", { from: local(2026, 12, 30), to: local(2027, 1, 2) });
  assert.equal(range?.from.toDateString(), local(2026, 12, 30).toDateString());
  assert.equal(range?.to.toDateString(), local(2027, 1, 3).toDateString());
});

test("custom date requires a selected date and resolves one day", () => {
  assert.equal(resolveDateRange("date", {}), null);
  const range = resolveDateRange("date", { from: local(2026, 9, 1) });
  assert.equal(range?.to.toDateString(), local(2026, 9, 2).toDateString());
});
