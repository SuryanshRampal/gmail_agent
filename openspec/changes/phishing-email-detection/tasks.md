## 1. Risk model and preflight signals

- [x] 1.1 Define typed phishing risk levels, confidence bands, evidence categories, and privacy-safe result validation; verify malformed and incomplete results fail closed.
- [x] 1.2 Implement normalized sender, reply-to, domain, authentication-header, URL, urgency, credential, and payment signal extraction from bounded message envelopes; verify raw message content and sensitive values are not logged.
- [x] 1.3 Extend local transformer inference and LangGraph routing to combine deterministic signals with social-engineering signals; verify low-risk, needs-attention, high-risk, and unavailable-model outcomes.

## 2. Gmail and permission-boundary integration

- [x] 2.1 Request and parse the Gmail metadata headers required for sender and authentication checks without fetching full message content; verify preflight makes no body, attachment, or inline-image request.
- [x] 2.2 Extend authenticated preflight responses with phishing assessment data while preserving the existing user/message-bound permission and fail-closed behavior; verify direct full-content requests remain protected.
- [x] 2.3 Add permitted post-open body and link scanning with URL normalization and safe destination metadata; verify the scan cannot navigate, download, submit, reply, forward, or mutate Gmail state.

## 3. Safe reader experience

- [x] 3.1 Add accessible low-risk, needs-attention, high-risk, and unable-to-verify states with explainable reasons and explicit open/keep-closed actions; verify protected content is not rendered before permission.
- [x] 3.2 Sanitize and render message links as inert or visibly unsafe until post-permission scanning completes; verify suspicious links require an individual explicit user action.
- [x] 3.3 Add retry and privacy-safe error handling for classifier, parser, and scan failures; verify uncertainty never appears as a safe verdict.

## 4. Verification and rollout

- [x] 4.1 Add classifier and signal-extraction tests covering sender impersonation, reply-to mismatch, lookalike domains, authentication states, URL obfuscation, credential/payment requests, benign promotions, and mixed signals.
- [x] 4.2 Add API tests covering authentication, bounded preflight, permission enforcement, post-consent scanning, no-fetch-on-denial, no-automatic-action, and privacy-safe logs.
- [x] 4.3 Run frontend/backend checks and manually verify low-risk, suspicious, high-risk, uncertain, unavailable-analysis, denied, permitted, and unsafe-link flows before enabling the feature flag by default.

## 5. Precision calibration and decision separation

- [x] 5.1 Separate sensitivity permission decisions from phishing-warning decisions in the guardrail result and reader state; verify a legitimate sensitive message can require permission without being labeled phishing.
- [x] 5.2 Calibrate phishing thresholds and top-label margin, require concrete evidence for elevated risk, and prevent model-only output from producing `high_risk`; verify generic urgency and ambiguous model output stay low risk or needs attention.
- [x] 5.3 Add a benign regression corpus for newsletters, promotions, social notifications, travel offers, gaming, sports, and news, plus corroborated attack cases; verify false-positive and high-risk acceptance criteria.
- [x] 5.4 Run the full frontend/backend suite and manually verify representative benign, sensitive-legitimate, suspicious, high-risk, uncertain, and unavailable-analysis messages before enabling the default behavior.
