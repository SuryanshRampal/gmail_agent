import { NextResponse } from "next/server";

import { GmailConnectionError, getEmail } from "@/lib/gmail";
import { requireUserId } from "@/lib/session";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await getEmail(await requireUserId(), (await params).id)); }
  catch (error) {
    if (error instanceof GmailConnectionError) return NextResponse.json({ error: error.message, reconnect: true }, { status: 401 });
    return NextResponse.json({ error: "We couldn't access this email right now. Please try again." }, { status: 500 });
  }
}
