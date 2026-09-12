import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { SignInButton } from "@/components/sign-in-button";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/dashboard");

  return (
    <main className="landing">
      <div className="landing-orb landing-orb-one" />
      <div className="landing-orb landing-orb-two" />
      <nav className="landing-nav"><span className="wordmark">Mercury <i>Mail</i></span><span>Private Gmail intelligence</span></nav>
      <section className="hero">
        <p className="eyebrow">YOUR INBOX, CLARIFIED</p>
        <h1>Work through email with a calmer mind.</h1>
        <p className="hero-copy">Read, understand, and respond with a private Gmail agent that keeps the details in focus.</p>
        <SignInButton />
        <p className="fine-print">You control access. Gmail permissions are limited to reading and sending email.</p>
      </section>
    </main>
  );
}
