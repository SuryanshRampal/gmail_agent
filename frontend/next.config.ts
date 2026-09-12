import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "path";

// The root .env holds existing local server credentials. These values remain
// server-only unless deliberately prefixed with NEXT_PUBLIC_.
config({ path: resolve(__dirname, "../.env"), quiet: true });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
