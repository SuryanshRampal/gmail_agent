import { NextResponse } from "next/server";

import { GmailConnectionError, getEmails, type EmailRange } from "@/lib/gmail";
import { requireUserId } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const mode = params.get("mode") as EmailRange["mode"];
    const from = params.get("from") || undefined;
    const to = params.get("to") || undefined;
    const timeZone = params.get("timeZone") || undefined;
    const pageToken = params.get("pageToken") || undefined;
    const search = params.get("search")?.trim() || undefined;
    const allTime = params.get("allTime") === "true";
    if (mode && !["recent", "date", "period"].includes(mode)) return NextResponse.json({ error: "Invalid email range." }, { status: 400 });
    if (!search && mode !== "recent" && (!from || !to)) return NextResponse.json({ error: "A complete date range is required." }, { status: 400 });
    if (from && to && (!/^\d+$/.test(from) || !/^\d+$/.test(to) || Number(from) >= Number(to))) return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
    if (timeZone) { try { new Intl.DateTimeFormat("en-US", { timeZone }).format(); } catch { return NextResponse.json({ error: "Invalid time zone." }, { status: 400 }); } }
    return NextResponse.json(await getEmails(await requireUserId(), { mode, from, to, pageToken, search, allTime }));
  }
  catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    if (error instanceof GmailConnectionError) return NextResponse.json({ error: error.message, reconnect: true }, { status: 401 });
    return NextResponse.json({ error: "We couldn't access your Gmail right now. Please try again." }, { status: 500 });
  }
}
