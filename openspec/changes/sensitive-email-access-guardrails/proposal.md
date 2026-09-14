## Why

The inbox currently opens message content as soon as a user selects a message. That can expose bank, medical, identity, or other personal information without an explicit acknowledgement. A pre-access guardrail will make the risk visible and require a deliberate permission decision before sensitive content is loaded.

## What Changes

- Analyze limited message metadata and available snippet text before loading the full message.
- Classify likely sensitive content into financial, medical, identity/personal, and other high-risk categories, with an uncertainty state when classification is inconclusive.
- Show a clear warning and the detected category before opening a flagged message.
- Require an explicit user action to open flagged content; deny or cancel must leave the full message and attachments unfetched.
- Enforce the same permission boundary for summaries, attachments, inline images, and any other operation that can retrieve full message content.
- Issue permission only from a server-verified, single-use preflight decision; a client-supplied message ID alone MUST NOT authorize access.
- Record only non-sensitive guardrail events needed for debugging and audit; never log message bodies, credentials, or extracted sensitive values.
- Keep ordinary, low-risk messages on the existing open flow and ensure the guardrail fails closed when analysis is unavailable.

## Capabilities

### New Capabilities

- `sensitive-email-access-guardrails`: Pre-access classification, user permission, and privacy-safe handling for potentially sensitive Gmail messages.

### Modified Capabilities

- None.

## Impact

- Frontend message selection and reader states in `frontend/components/dashboard.tsx`.
- Gmail message loading in `frontend/lib/gmail.ts` and the message API routes.
- Backend LangGraph agent workflow and transformer inference dependencies.
- New permission/preflight API contract and tests.
- Runtime model packaging, inference latency, and fallback behavior must be managed without exposing OAuth credentials to the classifier.
