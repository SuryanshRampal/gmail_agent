import { NextResponse } from "next/server";

import { GmailConnectionError, getEmails, type EmailRange } from "@/lib/gmail";
import { requireUserId } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const mode = params.get("mode") as EmailRange["mode"];
    const from = params.get("from") || undefined;
    const to = params.get("to") || undefined;
    if (mode && !["recent", "date", "period"].includes(mode)) return NextResponse.json({ error: "Invalid email range." }, { status: 400 });
    return NextResponse.json(await getEmails(await requireUserId(), { mode, from, to }));
  }
  catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    if (error instanceof GmailConnectionError) return NextResponse.json({ error: error.message, reconnect: true }, { status: 401 });
    return NextResponse.json({ error: "We couldn't access your Gmail right now. Please try again." }, { status: 500 });
  }
}
