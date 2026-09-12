import { NextResponse } from "next/server";

import { GmailConnectionError, getEmails } from "@/lib/gmail";
import { requireUserId } from "@/lib/session";

export async function GET() {
  try { return NextResponse.json(await getEmails(await requireUserId())); }
  catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    if (error instanceof GmailConnectionError) return NextResponse.json({ error: error.message, reconnect: true }, { status: 401 });
    return NextResponse.json({ error: "We couldn't access your Gmail right now. Please try again." }, { status: 500 });
  }
}
