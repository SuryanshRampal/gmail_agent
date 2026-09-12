import { NextResponse } from "next/server";

import { summarizeEmail } from "@/lib/ai";
import { GmailConnectionError, getEmail } from "@/lib/gmail";
import { requireUserId } from "@/lib/session";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const email = await getEmail(await requireUserId(), (await params).id);
    return NextResponse.json({ summary: await summarizeEmail(email.body ?? email.snippet) });
  } catch (error) {
    if (error instanceof GmailConnectionError) return NextResponse.json({ error: error.message, reconnect: true }, { status: 401 });
    return NextResponse.json({ error: "We couldn't generate a summary for this email. Please try again." }, { status: 500 });
  }
}
