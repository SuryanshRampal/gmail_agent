## 1. Guardrail contracts and model

- [x] 1.1 Define typed preflight categories, confidence bands, decisions, warnings, and permission envelopes; verify malformed results fail closed.
- [x] 1.2 Add configurable compact local transformers inference for financial, medical, identity/personal, and uncertain signals; verify bounded input and no raw-content logging.
- [x] 1.3 Build the LangGraph preflight workflow with authenticated context, classifier node, result validation, and fail-closed routing; verify unavailable-model and low-confidence scenarios require permission.

## 2. Server-side access control

- [x] 2.1 Add authenticated preflight endpoint using only limited message envelope data; verify it never calls full-message or attachment Gmail endpoints.
- [x] 2.2 Persist a short-lived user/message-bound preflight decision and consume a single-use nonce before issuing permission; verify expired, replayed, cross-user, and cross-message requests cannot receive a token.
- [x] 2.3 Centralize permission validation and enforce it on full-message, summary, attachment, and inline-image retrieval; verify direct requests without valid permission return a warning and make no Gmail content fetch.

## 3. User experience

- [x] 3.1 Add preflight loading and category-specific warning states before the reader; verify no sensitive body is rendered before permission.
- [x] 3.2 Add explicit “Open message” and “Keep closed” actions with scoped permission; verify denial preserves the closed state and does not fetch attachments.
- [ ] 3.3 Add accessible explanation, uncertainty copy, retry behavior, and privacy-safe error states; verify keyboard and screen-reader labels identify the decision clearly.

## 4. Verification and rollout

- [ ] 4.1 Add LangGraph/classifier tests for all categories, low confidence, malformed output, unavailable model, and privacy-safe logs.
- [ ] 4.2 Add API tests for authentication, preflight/nonce issuance, summary protection, permission scope/expiry, no-fetch-on-denial, and valid-fetch-on-consent using stubbed Gmail transport.
- [ ] 4.3 Run backend/frontend checks and manually verify low-risk, financial, medical, personal-data, uncertain, denied, permitted, and classifier-failure flows before enabling the feature flag.
