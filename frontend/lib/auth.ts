import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { postgresAdapter } from "@/lib/auth/postgres-adapter";

const googleClientId = process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID ?? process.env.Google_Client_Id;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? process.env.Google_Client_Secret;

if (!googleClientId || !googleClientSecret) {
  throw new Error("Google OAuth is not configured. Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET in frontend/.env.local.");
}

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  adapter: postgresAdapter,
  providers: [
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
          ].join(" "),
        },
      },
    }),
  ],
  session: { strategy: "jwt" as const },
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
  pages: { signIn: "/" },
} satisfies NextAuthOptions;

export default NextAuth(authOptions);
