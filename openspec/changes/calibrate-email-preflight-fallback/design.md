## Context

The existing preflight guard receives only a bounded Gmail envelope before full content is retrieved. It correctly detects clear sensitive and phishing signals, but it invokes a local transformers model for ordinary unrecognized messages. The deployed backend uses local-only model loading; when the model is absent, the current fail-closed default labels the message as unable to verify and adds an unnecessary permission step.

## Goals / Non-Goals

**Goals:**

- Preserve the existing user-and-message-bound permission boundary for meaningful risk.
- Let ordinary low-risk email open normally when the optional classifier is unavailable.
- Make the decision explainable, deterministic where possible, and covered by regression tests.
- Keep full bodies, attachments, and inline images unavailable to preflight.

**Non-Goals:**

- Claim that a low-risk result proves an email is safe.
- Treat model availability as a reason to disclose more message data.
- Add a third-party classifier or automatically trust all mail from a sender.
- Change the post-open phishing scan or message-permission lifetime.

## Decisions

- **Use deterministic triage before optional model inference.** Clear financial, medical, personal, authentication, phishing, or suspicious-link evidence continues to require permission immediately. Messages with no such evidence are allowed without invoking a model. This removes the model from the normal inbox path.

- **Use the classifier only for genuinely ambiguous envelopes.** An envelope with a limited potential signal that cannot be classified by deterministic rules may use the local model. Model output supplements the rules; it does not override concrete phishing evidence.

- **Make classifier failure conditional on observed risk.** If inference is unavailable, malformed, or times out, the system requires permission only when the bounded envelope contains an ambiguous or concrete risk signal. It allows messages with no risk signals. The existing global fail-closed fallback is rejected because it converts an infrastructure failure into a warning about every ordinary email.

- **Reserve `unable_to_verify` for an assessment problem, not normal model absence.** Missing required envelope data, an invalid assessment result, or an unavailable phishing parser remains unable to verify. A healthy deterministic low-risk assessment remains low risk even if optional language classification is unavailable.

- **Keep classifier availability private and measurable.** Emit only a privacy-safe metric/log field such as decision source and classifier availability. Do not log snippets, subjects, bodies, links, tokens, or extracted values. The user-facing UI should describe evidence found, not backend model status.

## Risks / Trade-offs

- [False negative from a short envelope] → The result remains bounded, full-content link scanning still runs after a user opens a message, and concrete suspicious indicators keep the permission gate.
- [Rules become too broad] → Add a regression matrix for benign, sensitive, phishing, ambiguous, and unavailable-model cases before rollout.
- [Classifier outage becomes invisible] → Record a privacy-safe availability metric and test the fallback path.
- [Future rules accidentally make all mail ambiguous] → Keep an explicit no-signal allow path and test simple messages such as “Check”, “Hello”, and “Meeting tomorrow”.

## Migration Plan

1. Add the deterministic decision helper and classify its result as no-signal, ambiguous, or concrete-risk.
2. Change model invocation and fallback behavior without changing the full-message permission APIs.
3. Add unit and API regression tests, including an unavailable-model deployment simulation.
4. Deploy to Preview and verify ordinary mail opens normally while financial and phishing examples still require permission.

Rollback restores the previous preflight function only; no database migration or token invalidation is required.
