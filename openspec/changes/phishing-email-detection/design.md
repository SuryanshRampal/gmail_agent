## Context

The Next.js application owns authenticated Gmail access and already sends a bounded envelope to the backend LangGraph preflight workflow before full message retrieval. Full content is protected by a short-lived, user-and-message-bound permission token. The new assessment must fit that flow and avoid turning phishing detection into an unexplainable binary verdict.

## Goals / Non-Goals

**Goals:**

- Add phishing assessment without exposing full content before permission.
- Combine strong deterministic security signals with local language classification.
- Present risk levels and evidence users can understand.
- Scan permitted body content and links locally before enabling risky interactions.
- Keep all automatic external actions disabled.

**Non-Goals:**

- Guarantee that a message is safe or malicious.
- Automatically delete, quarantine, report, or modify messages.
- Add a third-party URL reputation provider in the first implementation.
- Replace Gmail’s own anti-spam and anti-phishing systems.

## Decisions

- **Use a two-stage assessment.** Preflight checks sender identity, reply-to alignment, authentication headers when available, labels, subject, and bounded snippet text. A post-permission scan handles complete body text and URLs that were not visible during preflight. This catches hidden links while preserving the current access boundary.
- **Use layered scoring instead of transformers alone.** Deterministic rules handle domain mismatch, lookalike domains, reply-to mismatch, authentication failures, URL structure, and direct requests for credentials or payments. A local transformer contributes language signals for urgency, impersonation, and social engineering. Rules provide high-value evidence; the model helps with wording variation.
- **Separate sensitivity and phishing decisions.** The existing sensitivity classifier may require permission for a legitimate bank statement or booking confirmation, but that must not become a phishing warning. Phishing risk is elevated only by concrete security evidence; ordinary model uncertainty is neutral for phishing.
- **Prefer precision and abstention.** Use a calibrated phishing threshold around 0.88–0.92 plus a top-versus-second-label margin. A model-only result can reach `needs_attention` only at high confidence and can never reach `high_risk`; high risk requires corroborating deterministic evidence.
- **Use four risk levels.** `low_risk` opens normally; `needs_attention` opens through the user-initiated flow and receives a full-content warning/link scan; `high_risk` shows a stronger pre-open warning and restricts links; `unable_to_verify` fails safely without pretending the message is safe. The response includes confidence and category-level reasons, never raw extracted values.
- **Normalize before comparing.** Parse display names, addresses, domains, reply-to values, and URLs; normalize case, punycode, common obfuscation, and tracking wrappers before applying comparisons. Preserve the original destination only for the permitted reader’s safety display.
- **Keep navigation inert by default.** Render email HTML in the existing sandbox and route links through a safety-aware handler that can mark or block suspicious destinations. No link, attachment, form, reply, or forward is activated by scanning.
- **Extend existing guardrails rather than bypassing them.** The preflight response can carry phishing assessment alongside sensitivity categories. Full-body scanning, summaries, attachments, and inline images continue to require the same server-validated permission.

## Risks / Trade-offs

- [False negatives] A malicious signal may be hidden in an image, attachment, or content omitted from the snippet → label the assessment as bounded/best-effort and perform a second scan after permission.
- [False positives] Legitimate marketing or travel messages may use urgency and links → require multiple corroborating signals for high risk and show reasons so users can make the final decision.
- [Model calibration drift] A zero-shot model can assign non-trivial scores to unrelated text → keep model uncertainty separate from phishing, require a confidence margin, and maintain a benign-message regression set.
- [Authentication headers unavailable] Gmail metadata may not expose every authentication result → treat missing signals as unknown, not as a failure or proof of safety.
- [Lookalike-domain complexity] Unicode and brand impersonation can produce difficult comparisons → normalize domains and keep heuristic matches as evidence rather than an automatic verdict.
- [Link safety limitations] Local heuristics cannot know whether every destination is currently malicious → clearly communicate that the detector is advisory and never claim guaranteed safety.
- [Model or scanner outage] Local inference or parsing can fail → return `unable_to_verify`, preserve permission enforcement, and provide retry behavior.

## Migration Plan

1. Add typed phishing assessment results and tests behind the existing guardrail feature boundary.
2. Extend Gmail envelope metadata and the backend preflight graph without fetching full content.
3. Add post-permission body/link scanning and safe link rendering in the reader.
4. Enable for development accounts, inspect privacy-safe risk metrics, then enable by default after false-positive review.

Rollback disables phishing UI and assessment calls while retaining the existing sensitive-content permission checks. No data migration is required.
