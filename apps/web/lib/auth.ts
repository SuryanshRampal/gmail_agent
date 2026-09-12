import NextAuth from "next-auth";

// Providers are added once the PRD chooses the authentication experience.
// Keeping this explicit prevents an accidental production login surface.
export const authOptions = {
  providers: [],
  session: { strategy: "jwt" as const },
};

export default NextAuth(authOptions);
