## Context

The current logs show a successful Google callback followed by a Gmail refresh failure:

```text
googleError: invalid_grant
googleErrorDescription: Token has been expired or revoked.
```

The callback completes, but the subsequent Gmail loader reads an existing account row and attempts to refresh with its stored token. Signing out only clears the browser session; it does not replace the server-side OAuth account row.

## Goals / Non-Goals

**Goals:**

- Make revoked-token recovery a normal user action.
- Ensure a successful consent callback persists the newest token pair.
- Scope token replacement to the authenticated user, Google provider, and active OAuth environment.
- Keep access and refresh tokens encrypted at rest.
- Avoid deleting users, messages, conversations, or history.
- Provide deterministic tests for the failure and recovery paths.

**Non-Goals:**

- Changing Google OAuth clients or redirect URIs.
- Sharing OAuth tokens between local, Preview, and Production.
- Automatically retrying a permanently revoked refresh token forever.
- Removing old OAuth accounts from other environments.
- Migrating existing conversation or Gmail data.

## Decisions

- **Use an explicit reconnect action.** A normal sign-out/sign-in is ambiguous because it may reuse an already linked account. The UI will start a clearly named reconnect flow when the Gmail connection is invalid.
- **Persist callback tokens explicitly.** The callback path will upsert the returned Google account token data, including a newly returned refresh token, rather than relying only on whether NextAuth invokes `linkAccount` for an existing account.
- **Use an environment-scoped account key.** Reads and writes will include the authenticated user ID, provider, provider account ID, and `oauth_environment`. This prevents a local token from replacing a Preview or Production token.
- **Handle `invalid_grant` as a terminal connection state.** The Gmail loader will stop retrying the same revoked refresh token and return a reconnect-required result. It will not expose token values or Google authorization codes to the client.
- **Keep encryption unchanged.** New and replacement access/refresh tokens will use the existing token encryption helper before reaching Postgres. The database will never receive plaintext token values.
- **Use controlled cleanup only as a fallback.** If a legacy malformed account row prevents the first relink, a server-side, authenticated reconnect operation may replace that exact environment-scoped row. Manual SQL is not part of the normal user flow.

## Risks / Trade-offs

- [Callback persistence regression] Incorrect upsert scoping could replace another environment’s token → test all three environments and require the environment predicate in every query.
- [Missing refresh token] Google may omit a refresh token on a later authorization → preserve the existing token only when it is still valid; a reconnect with explicit consent must replace a revoked token when Google returns a new one.
- [Repeated reconnect loops] A broken client configuration could produce repeated failures → show the reconnect error and log only provider/error metadata, not tokens.
- [Account uniqueness conflict] Existing schema constraints may reject an insert → inspect the current constraint and use an update/upsert strategy compatible with the environment-aware schema.
- [User confusion] “401” is not actionable → translate `invalid_grant` into clear reconnect instructions.

## Migration Plan

1. Add tests and implement the environment-scoped callback token upsert without changing OAuth client configuration.
2. Add the reconnect-required result and UI action for `invalid_grant`.
3. Run lint, type-check, unit tests, and adapter tests locally.
4. Test local first with the local Google client; then test Preview and Production separately with their respective Vercel variables and redirect URLs.
5. If verification passes, deploy Preview and confirm the stored token changes and Gmail refresh succeeds.

Rollback is a code rollback. No user data migration is required; existing account rows remain intact unless the authenticated reconnect flow replaces the targeted environment-scoped token.
