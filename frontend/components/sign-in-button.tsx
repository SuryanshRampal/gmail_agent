"use client";

import { signIn } from "next-auth/react";

export function SignInButton() {
  return <button className="button button-primary" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>Continue with Google <span aria-hidden>→</span></button>;
}
