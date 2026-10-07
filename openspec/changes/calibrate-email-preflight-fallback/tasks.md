## 1. Risk-aware preflight behavior

- [x] 1.1 Add deterministic no-signal, ambiguous, and concrete-risk decision helpers; verify ordinary messages bypass optional inference.
- [x] 1.2 Change classifier fallback so model failure allows no-signal messages but protects ambiguous and concrete-risk messages; verify each fallback branch with unit tests.
- [x] 1.3 Keep phishing and sensitivity signals separate in the returned assessment; verify phishing reasons remain visible when present.

## 2. Regression coverage and observability

- [x] 2.1 Add preflight regression tests for “Check”, “Hello”, and “Meeting tomorrow” with the classifier unavailable; verify each returns allow.
- [x] 2.2 Add tests for financial, medical, OTP, booking, corroborated sender/reply mismatch, authentication failure, and suspicious-link envelopes with the classifier unavailable; verify each requires permission.
- [x] 2.3 Add privacy-safe classifier-availability telemetry and test that diagnostics exclude bounded message content and credentials.

## 3. Integration verification

- [x] 3.1 Run backend guardrail/API tests and frontend lint, tests, and type-check; verify no permission API contract changes are needed.
- [ ] 3.2 Verify in Preview that a normal self-sent email opens normally, while a bank/OTP sample and a suspicious-link sample remain permission-gated.
