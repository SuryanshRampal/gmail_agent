## Why

Users can receive messages that appear trustworthy while attempting to steal credentials, payment information, or personal data. The inbox should provide an explainable phishing-risk assessment before users act on a suspicious message, while preserving the existing privacy boundary around full message content.

## What Changes

- Add a phishing-risk assessment to message preflight using sender identity, relevant headers, subject, date, labels, and bounded snippet data.
- Combine deterministic email-security signals with local transformer classification for social-engineering language.
- Return explainable risk levels: low risk, needs attention, high risk, or unable to verify.
- Separate phishing warnings from sensitive-content permission decisions so ordinary mail is not treated as phishing merely because a sensitivity model is uncertain.
- Require concrete, independently corroborating security evidence for elevated phishing risk and calibrate model thresholds for precision.
- Show a warning before suspicious content is opened and disable or clearly mark links until post-open scanning completes.
- Scan full message content and links only after the existing user-and-message-bound permission is granted.
- Never automatically click links, download attachments, send replies, or forward messages as part of detection.
- Keep diagnostics privacy-safe by excluding raw message content, URLs where possible, credentials, tokens, and extracted sensitive values.
- Preserve normal low-risk handling for legitimate promotions, newsletters, social notifications, travel offers, gaming updates, and news mail.

## Capabilities

### New Capabilities

- `phishing-email-detection`: Explainable, privacy-preserving phishing-risk assessment and safe message interaction behavior.

### Modified Capabilities

None. The existing sensitive-email guardrail is still an in-flight change rather than a durable capability spec; its integration is captured in the design and implementation tasks below.

## Impact

- Extends the backend LangGraph preflight workflow and local classifier configuration.
- Adds Gmail metadata/header collection needed for sender and authentication checks.
- Extends the Next.js preflight and message-reader APIs and UI states.
- Adds local URL parsing, normalization, and link-safety handling without requiring a third-party reputation service initially.
- Adds calibrated classifier, API, privacy, and UI tests for benign mail, concrete suspicious evidence, high-risk combinations, uncertain analysis, and unavailable-analysis scenarios.
