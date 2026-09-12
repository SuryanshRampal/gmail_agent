import { NextResponse } from "next/server";
import { z } from "zod";

import { GmailConnectionError, sendEmail } from "@/lib/gmail";
import { requireUserId } from "@/lib/session";

const emailSchema = z.object({ to: z.string().email("Enter a valid recipient email."), subject: z.string().trim().min(1, "Add a subject.").max(998), body: z.string().trim().min(1, "Write a message before sending.").max(100000) });

export async function POST(request: Request) {
  try {
    const email = emailSchema.parse(await request.json());
    await sendEmail(await requireUserId(), email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid email." }, { status: 400 });
    if (error instanceof GmailConnectionError) return NextResponse.json({ error: error.message, reconnect: true }, { status: 401 });
    return NextResponse.json({ error: "We couldn't send the email. Please try again." }, { status: 500 });
  }
}
