## Why

The product can currently read and summarize Gmail messages, but users still need to manually compose messages when they want to follow up. A dedicated outbound email agent will turn an explicit user request into a useful draft while keeping the irreversible act of sending under the user’s control.

## What Changes

- Add an agent capability that interprets a user’s explicit request to write an email.
- Generate a structured draft with recipient, subject, body, and any unresolved assumptions called out.
- Show the draft for review and require explicit user confirmation before sending.
- Reuse the authenticated Gmail account and existing send transport only after confirmation.
- Validate recipients, prevent invented recipient addresses, and handle missing or ambiguous details with a clarification state.
- Provide clear success, failure, and retry states without duplicating a send.

## Capabilities

### New Capabilities

- `outbound-email-agent`: Defines intent interpretation, draft generation, review, confirmation, and safe Gmail sending.

### Modified Capabilities

- None.

## Impact

- Affected frontend: conversation/request surface, draft review UI, confirmation controls, and send status.
- Affected backend: agent graph, authenticated draft endpoint, send-confirmation endpoint, and idempotency handling.
- Affected external system: Gmail send API and OpenRouter model provider.
- No new OAuth scope is expected; the current `gmail.send` scope is sufficient.
