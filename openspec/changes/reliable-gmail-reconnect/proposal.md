## Why

When a Google refresh token is revoked or expires, Gmail requests return `401` with `invalid_grant`. The user can complete Google sign-in successfully, but the application may continue reading the old encrypted refresh token from `next_auth.accounts`. Recovery currently requires manual database intervention, which is not an acceptable user flow.

## What Changes

- Detect an expired or revoked Gmail connection and return a clear reconnectable application state.
- Add an explicit “Reconnect Gmail” flow that starts Google OAuth with offline access and consent.
- On a successful Google callback, reliably replace the encrypted access and refresh tokens for the authenticated user, Google provider, and current OAuth environment.
- Keep local, Preview, and Production OAuth account records isolated by `oauth_environment`.
- Preserve existing Gmail data, users, conversations, and history while replacing only the invalid OAuth connection.
- Do not require cookie deletion, incognito mode, manual SQL, or changing redirect URLs for normal recovery.
- Add tests proving that a revoked token can be replaced and that a later Gmail token refresh succeeds.

## Capabilities

### New Capabilities

- `reliable-gmail-reconnect`: User-facing recovery and server-side token replacement for revoked or expired Google OAuth connections.

### Modified Capabilities

- Gmail message loading and authentication account persistence.

## Impact

- `frontend/lib/auth.ts` and the custom Postgres adapter.
- Gmail token loading and refresh handling in `frontend/lib/gmail.ts`.
- Sign-in/reconnect UI and related API routes.
- OAuth account persistence and environment isolation in `next_auth.accounts`.
- Automated tests and manual verification for local, Preview, and Production configuration.
