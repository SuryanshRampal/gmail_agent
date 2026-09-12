# Gmail Agent

Gmail agent MVP with a Next.js web app, FastAPI service, Supabase Postgres, and
Google OAuth through NextAuth.js.

## Structure

- `frontend` — Next.js App Router frontend (TypeScript)
- `backend` — FastAPI backend (Python) and Supabase workspace

## Start locally

1. Ensure the existing `next_auth` schema from
   `docs/next_auth_schema.sql` is present in the Supabase database. The app
   uses those tables directly and does not create a duplicate auth schema.
2. Copy `frontend/.env.local.example` to `frontend/.env.local`. Set
   `DATABASE_URL`, Google OAuth credentials, `NEXTAUTH_SECRET`, and a distinct
   32-byte base64 `TOKEN_ENCRYPTION_KEY`.
3. Configure the Google OAuth client with `http://localhost:3000` as an
   authorized JavaScript origin and
   `http://localhost:3000/api/auth/callback/google` as an authorized redirect
   URI. Enable Gmail API and add your account as a test user.
4. Add `OPENAI_API_KEY` only if you want live AI summaries. The feature gives a
   clear configuration error until it is set.
3. Install and run the web app:

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

5. Create a backend virtual environment and run the API:

   ```sh
   python3 -m venv backend/.venv
   backend/.venv/bin/pip install -e 'backend[dev]'
   backend/.venv/bin/uvicorn app.main:app --app-dir backend --reload --port 8000
   ```

The web app is available at `http://localhost:3000`; the API health check is
at `http://localhost:8000/health`.

## Environment and security

`DATABASE_URL`, `NEXTAUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, Google OAuth
credentials, and `OPENAI_API_KEY` are server-only. Do not add them to a
variable prefixed with `NEXT_PUBLIC_`.

Access and refresh tokens are AES-256-GCM encrypted before they are persisted
to `next_auth.accounts`; the browser never receives them. Future public-schema
tables must have explicit Row Level Security policies and Data API exposure
where needed.
