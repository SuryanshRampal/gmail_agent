# Gmail Agent

Full-stack starter for a Next.js web app, a FastAPI service, Supabase Postgres,
and NextAuth.js authentication. Product-specific database tables and auth
providers intentionally wait for the PRD.

## Structure

- `apps/web` — Next.js App Router frontend (TypeScript)
- `apps/api` — FastAPI backend (Python)
- `supabase` — Supabase configuration and future migrations

## Start locally

1. Copy `.env.example` to `.env` and add your Supabase project credentials.
2. Copy `apps/web/.env.local.example` to `apps/web/.env.local`, then generate
   an `AUTH_SECRET` with `openssl rand -base64 32`.
3. Install and run the web app:

   ```sh
   npm install
   npm run dev:web
   ```

4. Create a backend virtual environment and run the API:

   ```sh
   python3 -m venv apps/api/.venv
   apps/api/.venv/bin/pip install -e 'apps/api[dev]'
   npm run dev:api
   ```

The web app is available at `http://localhost:3000`; the API health check is
at `http://localhost:8000/health`.

## Environment and security

`SUPABASE_SERVICE_ROLE_KEY` is backend-only. Do not add it to the Next.js
environment or a variable prefixed with `NEXT_PUBLIC_`.

Use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only for browser access protected by
Row Level Security. The initial project has no application tables yet; all
future public-schema tables will require explicit RLS policies and Data API
exposure where needed.
