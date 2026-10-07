## 1. Diagnose and define the contract

- [x] 1.1 Confirm the current `next_auth.accounts` uniqueness constraints and environment columns without exposing token values.
- [x] 1.2 Define typed reconnect-required behavior for `invalid_grant` and other permanent OAuth refresh failures.
- [x] 1.3 Define the callback token-upsert contract, including when a returned refresh token replaces the stored encrypted value.

## 2. Persist replacement tokens safely

- [x] 2.1 Add an environment-scoped adapter/upsert operation for Google account tokens.
- [x] 2.2 Invoke the operation on successful Google callbacks, including existing linked accounts.
- [x] 2.3 Verify access and refresh tokens are encrypted before database writes and never logged.
- [x] 2.4 Verify local, Preview, and Production records cannot overwrite one another.

## 3. Add reconnect UX

- [x] 3.1 Return a reconnect-required response when Gmail refresh returns `invalid_grant`.
- [x] 3.2 Add a clear “Reconnect Gmail” action that starts OAuth consent for the current environment.
- [x] 3.3 Show an actionable error without exposing Google codes, token values, or database details.

## 4. Verification and rollout

- [x] 4.1 Add adapter tests for token encryption, replacement semantics, missing refresh tokens, revoked-token cleanup, and environment isolation.
- [ ] 4.2 Add Gmail tests for successful refresh, `invalid_grant`, and no repeated retry loop.
- [x] 4.3 Run lint, type-check, all tests, and a production build locally.
- [ ] 4.4 Verify local, Preview, and Production separately with their intended Google clients.
- [ ] 4.5 Deploy Preview only after explicit approval, then verify token replacement and Gmail loading.
