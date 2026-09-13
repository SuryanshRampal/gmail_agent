## Context

See proposal.md for motivation. The existing application already has an authenticated Next.js Gmail transport and a separate FastAPI/LangGraph summarization agent. The current send endpoint accepts validated fields and sends immediately, so the new capability must add a deliberate draft/confirmation boundary around that transport.

## Goals / Non-Goals

**Goals:**

- Separate intent understanding, draft generation, review, confirmation, and Gmail delivery.
- Make the final send payload visible and editable before authorization.
- Keep OAuth credentials and provider secrets in the existing server-side boundaries.
- Make retries safe when the network result of a send is ambiguous.

**Non-Goals:**

- Automatic sending from an email read or summary action.
- Bulk campaigns, scheduled sending, attachments, HTML templates, or contact-management features in the first version.
- Letting the model directly call Gmail or choose an unverified recipient address.

## Decisions

### Use a draft-first agent graph

The agent will return a typed draft or a clarification request. A draft identifier and normalized sendable fields will be stored server-side or signed as a short-lived artifact. The model will never receive credentials and will not own the send transition.

Returning free-form prose was rejected because the UI and safety layer need reliable recipient, subject, body, and missing-detail fields.

### Require confirmation against a draft revision

The review UI will maintain a draft revision. The confirmation endpoint will accept the draft identifier, revision, and an explicit confirmation action; it will reject stale or edited revisions. This prevents a user from confirming one version while a different version is sent.

### Resolve recipients deterministically

The first version will require an exact email address in the request or an explicit user selection from trusted Gmail contacts/context. Name-only guesses will become clarification states. The model may suggest a recipient label, but the server validates the final address.

### Add idempotency at the send boundary

The client will create an idempotency key for a confirmed draft revision. The server will record send attempts and reuse the prior result for a repeated key. This protects against double sends on timeout/retry; the existing raw Gmail send helper remains the delivery mechanism.

### Keep provider fallback explicit

If the configured model cannot generate a safe structured draft, the system will return a clarification or provider error. It will not silently fall back to an unstructured auto-send path.

## Risks / Trade-offs

- [The model invents context or overstates certainty] → Require grounded prompts, typed output validation, and visible assumptions before confirmation.
- [A user sends to the wrong recipient] → Require exact address validation and prominent recipient review; never infer ambiguous names.
- [Network ambiguity causes duplicate sends] → Persist idempotency results around the send transition and make retries reuse the same key.
- [Drafts contain sensitive email content] → Use short-lived, user-scoped server storage and avoid logging draft bodies.
- [Existing direct compose flow changes unexpectedly] → Keep the current explicit compose form working and integrate the agent as an additional entry path.

## Migration Plan

1. Add typed draft and clarification contracts without changing the existing send endpoint behavior.
2. Implement the agent draft endpoint and review UI behind the existing authenticated dashboard.
3. Add the confirmed-send endpoint with idempotency and integration tests using a Gmail transport stub.
4. Enable the agent entry point after manual verification with a test recipient; retain the existing compose path as fallback.
