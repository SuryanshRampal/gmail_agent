## Context

The Next.js service currently owns authenticated Gmail access and fetches a full message from `GET /api/gmail/messages/:id` when the user selects it. The backend already contains a LangGraph summarization workflow and is isolated from Gmail OAuth credentials. The new guardrail must preserve that ownership boundary while adding local transformer inference before full retrieval.

## Goals / Non-Goals

**Goals:**

- Establish a fail-closed preflight decision before full body, attachment, or inline-image retrieval.
- Keep Gmail OAuth credentials and raw message content out of the classifier service logs.
- Provide category-specific, user-visible permission and a short-lived per-message authorization.
- Avoid sending sensitive content to a third-party model for classification.

**Non-Goals:**

- Perfect detection or legal/compliance certification.
- Redacting or rewriting the user’s Gmail data.
- Scanning attachments before permission; attachment retrieval remains blocked with the full message.
- Granting automatic permission for future messages from the same sender.

## Decisions

- **Use a LangGraph preflight graph.** The graph will authenticate the user context, validate the limited candidate envelope, run transformer classification, validate a typed result, and route to `allow`, `permission_required`, or `blocked`. This makes fail-closed transitions explicit and testable. A direct helper was considered, but would make error routing and authorization easier to bypass as the workflow grows.
- **Use a locally hosted transformers classifier.** A compact text-classification/NER pipeline will inspect sender, subject, and limited snippet text in the backend runtime. A remote LLM was rejected because it would transmit potentially sensitive content outside the application and make privacy behavior dependent on provider availability.
- **Keep the full-message fetch behind the Next.js permission boundary.** The browser first requests preflight; only a valid server-issued, short-lived permission token can be supplied to the full-message route. The backend receives no Gmail credentials. A client-only boolean was rejected because it cannot enforce the boundary against direct API calls.
- **Make preflight authorization server-verifiable and single-use.** Preflight will create a short-lived record containing the authenticated user, exact message ID, decision, and nonce. The permission endpoint will consume that nonce before issuing an encrypted access token. A token minted from a client-provided message ID was rejected because it allows callers to skip preflight entirely.
- **Centralize content permission validation.** One shared Next.js helper will validate the access token before full-message retrieval, summary generation, attachment retrieval, or inline-image retrieval. This avoids a route-specific bypass such as a summary endpoint calling the Gmail loader directly.
- **Use conservative categories and confidence bands.** Financial, medical, identity/personal, and `uncertain` are user-facing categories. Low-confidence or unavailable inference routes to permission rather than silently allowing access. The classifier result is advisory; the server authorization is authoritative.
- **Do not persist raw snippets or classifier spans.** Store only short-lived permission state and privacy-safe telemetry. This limits the impact of logs and database inspection while retaining enough information to diagnose false positives.

## Risks / Trade-offs

- [False negatives] A snippet may omit sensitive body content → route uncertain or unavailable classification to permission and describe detection as best-effort.
- [False positives] Ordinary mail may require an extra click → provide a clear explanation and a narrowly scoped “Open message” action.
- [Inference latency] Local model loading can slow first selection → load the model once per worker, cap input length, and show a preflight loading state.
- [Model/runtime size] Transformers increases backend footprint → choose a small CPU-compatible model and make the model identifier configurable.
- [Direct API bypass] Calling the full-message endpoint directly could skip UI → enforce permission validation in the server route, not only in React state.
- [Route bypass] A new content-consuming endpoint could forget the guard → require all full-content operations to call the shared validator and cover this contract with API tests.
- [Nonce storage failure] A preflight decision may not be persisted → fail closed and do not issue a token; retry preflight rather than falling back to client state.
- [Permission leakage] A token could be replayed → bind it to user ID and message ID, encrypt/sign it with existing server encryption, and enforce a short expiry.

## Migration Plan

1. Add the classifier dependency/model configuration and LangGraph preflight workflow behind a feature flag.
2. Add the preflight and permission endpoints, then enforce the permission token in the full-message route.
3. Add the warning, loading, denial, and open states to message selection.
4. Run unit, API, and privacy-log tests; manually exercise low-risk, flagged, unavailable-model, denied, and permitted flows.
5. Enable for development/test accounts first, then enable by default after observing false-positive and latency metrics that contain no message content.

Rollback disables the UI and preflight flag while retaining the full-message permission check until the change is safely reverted; no user data migration is required.
