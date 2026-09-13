## 1. Agent contracts and intent

- [x] 1.1 Define typed draft, clarification, assumption, and send-status contracts; verify invalid model output is rejected without creating a sendable draft.
- [x] 1.2 Add intent classification for explicit email-writing requests; verify informational and summary requests do not enter the outbound flow.
- [x] 1.3 Implement grounded draft generation using recipient, subject, body, tone, and assumptions; verify missing recipient or materially ambiguous purpose produces clarification.

## 2. Review and authorization

- [x] 2.1 Add authenticated draft creation and retrieval with user scoping and short-lived lifecycle; verify one user cannot read another user’s draft.
- [x] 2.2 Add editable draft review UI with prominent recipient, subject, body, assumptions, and explicit confirmation; verify editing invalidates prior confirmation.
- [x] 2.3 Validate exact recipient addresses and block ambiguous name-only recipients; verify invalid and ambiguous recipients cannot reach send.

## 3. Safe Gmail delivery

- [x] 3.1 Add confirmed-send transition that accepts only the reviewed draft revision and reuses the existing Gmail send transport; verify no send occurs during draft generation.
- [x] 3.2 Add idempotency persistence for confirmed draft revisions; verify retrying an acknowledged or ambiguous send does not create a duplicate Gmail message.
- [x] 3.3 Add pending, success, failure, and retry UI states; verify a transient failure preserves the reviewed draft and offers retry.

## 4. Verification and rollout

- [ ] 4.1 Add agent tests for grounded content, clarification, recipient safety, authorization, and provider failures; verify no credentials or draft bodies are written to logs.
- [ ] 4.2 Add Gmail transport integration tests with a stubbed send provider; verify exact recipient/subject/body payload and idempotent retries.
- [ ] 4.3 Run frontend lint/build and backend tests, then manually verify the complete draft-review-confirm-send flow with a test recipient before enabling the agent entry point.
