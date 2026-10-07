## Why

Ordinary low-risk messages such as a self-sent “Check” are currently forced through the sensitive-content permission screen when the optional local classifier is unavailable. This makes the inbox cumbersome without indicating that the message itself has evidence of risk.

## What Changes

- Make preflight decisions risk-aware when the optional classifier cannot run.
- Permit normal opening for messages with no concrete sensitive-content or phishing indicators, even when model inference is unavailable.
- Continue to require explicit permission when deterministic financial, medical, personal-data, authentication, or phishing evidence exists.
- Treat model availability as operational telemetry rather than a user-facing security finding.
- Add benign-message regression coverage and unavailable-model coverage.

## Capabilities

### New Capabilities

- `risk-aware-email-preflight`: Calibrated preflight decisions that retain privacy protection without blocking ordinary low-risk mail during classifier outages.

### Modified Capabilities

- None.

## Impact

- Backend preflight decision logic and tests in `backend/app/guardrails.py`.
- Preflight response/UI wording in the Next.js reader where necessary.
- Deployment configuration and privacy-safe monitoring for classifier availability.
