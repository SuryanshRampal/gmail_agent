## Purpose

Ensures that email preflight keeps meaningful sensitive and phishing warnings while allowing ordinary low-risk messages to open normally during optional classifier outages.

## ADDED Requirements

### Requirement: Preflight decisions distinguish message risk from classifier availability

The system SHALL evaluate bounded envelope evidence before relying on optional language-model inference. An unavailable, malformed, or timed-out optional classifier SHALL NOT by itself classify a message as sensitive, suspicious, or unable to verify.

#### Scenario: Ordinary message while classifier is unavailable

- **WHEN** a selected message has no concrete sensitive-content or phishing indicator in its bounded envelope and the optional classifier cannot run
- **THEN** preflight returns an allow decision and the normal message-open flow continues

#### Scenario: Concrete sensitive signal while classifier is unavailable

- **WHEN** a selected message contains a deterministic financial, medical, personal-data, security-code, booking, or transaction indicator and the optional classifier cannot run
- **THEN** preflight requires explicit permission before full content retrieval

#### Scenario: Concrete phishing signal while classifier is unavailable

- **WHEN** a selected message has a corroborated sender/reply mismatch, authentication failure, suspicious destination, credential request, or other corroborated phishing indicator and the optional classifier cannot run
- **THEN** preflight requires explicit permission and returns the available user-readable reasons

### Requirement: Optional classification is limited to ambiguous bounded envelopes

The system SHALL invoke optional language classification only when deterministic preflight evidence is ambiguous. Messages with no relevant evidence SHALL not depend on classifier availability to open, and concrete-risk messages SHALL remain protected regardless of classifier output.

#### Scenario: Simple ordinary email

- **WHEN** the envelope contains a simple ordinary subject or snippet such as “Check”, “Hello”, or “Meeting tomorrow” and no other risk signal
- **THEN** preflight returns an allow decision without requiring classifier inference

#### Scenario: Ambiguous envelope during classifier outage

- **WHEN** an envelope contains limited potential sensitive evidence that deterministic rules cannot resolve and the optional classifier is unavailable
- **THEN** preflight requires explicit permission before full content retrieval

### Requirement: Preflight remains privacy-preserving and observable

The system SHALL continue to use only bounded envelope fields before permission, retain the existing scoped permission requirement for full-content operations, and record classifier availability only through privacy-safe telemetry.

#### Scenario: Low-risk fallback does not bypass full-content protections for later operations

- **WHEN** a message is allowed through low-risk preflight and the user requests a summary, reply, attachment, or inline-image operation that requires full content
- **THEN** the system enforces the existing authenticated and message-scoped authorization for that operation

#### Scenario: Classifier outage telemetry

- **WHEN** optional classifier inference is unavailable, malformed, or times out
- **THEN** diagnostics record no raw snippet, subject, body, URL, token, or extracted sensitive value
