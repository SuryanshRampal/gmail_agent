## Purpose

Protects users from unexpected exposure of financial, medical, identity, and other personal email content by classifying messages before full content access and requiring explicit permission for flagged messages.

## ADDED Requirements

### Requirement: Classify before full message access

The system SHALL perform a preflight sensitivity assessment using only the message identifier, sender, subject, date, labels, and limited snippet data available before full-message retrieval. The assessment SHALL return one or more categories, a confidence/uncertainty state, and a user-readable explanation. Full body parts, attachments, and inline images MUST NOT be fetched as part of preflight classification.

#### Scenario: Low-risk message opens normally

- **WHEN** preflight classifies a selected message as low risk with sufficient confidence
- **THEN** the system permits the existing full-message request to continue without an additional permission prompt

#### Scenario: Financial content is flagged

- **WHEN** preflight detects likely bank, payment-card, account, transaction, tax, or other financial information
- **THEN** the system returns a financial warning before full content is fetched

#### Scenario: Medical content is flagged

- **WHEN** preflight detects likely diagnoses, prescriptions, appointments, test results, insurance, or other medical information
- **THEN** the system returns a medical warning before full content is fetched

#### Scenario: Personal or identity content is flagged

- **WHEN** preflight detects likely government identifiers, passwords, authentication codes, addresses, phone numbers, or other personal information
- **THEN** the system returns a personal-data warning before full content is fetched

### Requirement: Require explicit permission for flagged messages

The system SHALL block full message retrieval for flagged or uncertain messages until the authenticated user explicitly chooses to open the content. The permission decision SHALL be scoped to the specific user and message, expire after a short period, and never grant blanket access to other messages.

#### Scenario: User permits one flagged message

- **WHEN** the user reviews the warning and selects “Open message”
- **THEN** the system records a short-lived permission for that user and message and fetches the full message

#### Scenario: User declines access

- **WHEN** the user selects “Keep closed” or dismisses the warning
- **THEN** the system does not fetch full body parts, attachments, or inline images and keeps the message content closed

#### Scenario: Unauthenticated or mismatched permission

- **WHEN** a permission request is missing authentication, belongs to another user, targets another message, or is expired
- **THEN** the system rejects it and does not fetch the full message

#### Scenario: Permission cannot be minted without preflight

- **WHEN** a client requests permission without a valid, unexpired, single-use preflight decision for the authenticated user and exact message
- **THEN** the system rejects the request and does not issue an access token

#### Scenario: Permission nonce cannot be replayed

- **WHEN** a previously consumed preflight decision is submitted again
- **THEN** the system rejects it and does not authorize message retrieval

### Requirement: Protect every full-content operation

The system SHALL require the same valid, short-lived, user-and-message-bound permission for full message retrieval, AI summary generation, attachment retrieval, inline-image retrieval, and any future operation that reads full message content. No downstream route may call the full-message loader before validating this permission.

#### Scenario: Summary cannot bypass consent

- **WHEN** a user requests a summary for a message without valid permission
- **THEN** the system rejects the request before loading the full message

#### Scenario: Authorized summary uses the permitted message

- **WHEN** a user requests a summary with valid permission for the exact message
- **THEN** the system may load that message and generate its summary

#### Scenario: Permission is scoped to one message

- **WHEN** a valid permission for message A is presented for message B or for an attachment belonging to message B
- **THEN** the system rejects the request before any full content is fetched

### Requirement: Fail closed and preserve privacy

The system SHALL treat classifier errors, unavailable models, malformed classifier output, and ambiguous high-risk results as requiring permission. Guardrail logs MUST contain only message identifiers, category labels, confidence bands, decision status, request identifiers, and timings; they MUST NOT contain message bodies, snippets, access tokens, attachment contents, or extracted sensitive values.

#### Scenario: Classifier unavailable

- **WHEN** the transformer or LangGraph guardrail cannot complete preflight
- **THEN** the system shows an unable-to-assess warning and requires explicit permission before full retrieval

#### Scenario: Sensitive values are not logged

- **WHEN** preflight, permission, or full retrieval succeeds or fails
- **THEN** diagnostic output excludes the message text and any detected account, health, identity, or personal values

### Requirement: Explain the decision to the user

The permission UI SHALL identify why access was paused, name the detected category or uncertainty, and make the consequences of opening clear without displaying the sensitive content itself.

#### Scenario: Warning is understandable without content exposure

- **WHEN** a flagged message is selected
- **THEN** the user sees a concise category-specific explanation, an explicit open action, and a keep-closed action before the reader displays the message body
