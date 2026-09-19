import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "path";

// The root .env holds existing local server credentials. These values remain
// server-only unless deliberately prefixed with NEXT_PUBLIC_.
config({ path: resolve(__dirname, "../.env"), quiet: true });
if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
} else if (!process.env.NEXTAUTH_URL && process.env.NODE_ENV !== "production") {
  process.env.NEXTAUTH_URL = "http://localhost:3000";
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
