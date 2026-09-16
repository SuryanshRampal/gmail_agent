## Purpose

Provides users with an explainable phishing-risk assessment and safer email interactions without weakening the existing privacy boundary around message content.

## ADDED Requirements

### Requirement: Assess phishing risk before full message access

The system SHALL assess a selected message using only its identifier, sender, relevant headers, subject, date, labels, and bounded snippet data before retrieving the full body, attachments, or inline images.

#### Scenario: Preflight uses limited message data

- **WHEN** a user selects a message
- **THEN** the system performs the initial phishing assessment without fetching full body parts, attachments, or inline images

#### Scenario: Incomplete preflight data

- **WHEN** required security signals are unavailable or the assessment cannot complete
- **THEN** the system reports that the message could not be fully verified and does not claim that it is safe

### Requirement: Return explainable phishing risk

The system SHALL return one risk level—`low_risk`, `needs_attention`, `high_risk`, or `unable_to_verify`—with confidence and user-readable reasons based on observable security signals. Model uncertainty alone MUST NOT produce `high_risk`.

#### Scenario: Low-risk message

- **WHEN** sender identity, authentication signals, language, and available links provide no meaningful phishing indicators
- **THEN** the system returns `low_risk` and permits the normal open flow

#### Scenario: Suspicious message

- **WHEN** the message contains one or more meaningful indicators such as sender mismatch, lookalike domain, unusual reply address, credential request, or urgent payment language
- **THEN** the system returns `needs_attention` or `high_risk` with the indicators that caused the result

#### Scenario: Model uncertainty without security evidence

- **WHEN** the language model has a weak or ambiguous phishing prediction but the message has no concrete sender, authentication, URL, or action-request indicator
- **THEN** the system returns `low_risk` for phishing and does not show a phishing warning

### Requirement: Avoid false-positive phishing warnings

The system SHALL keep ordinary legitimate promotions, newsletters, social notifications, travel offers, gaming updates, sports updates, and news mail at `low_risk` unless they also contain concrete phishing evidence. Sensitivity classification and phishing classification MUST remain separate decisions.

#### Scenario: Benign promotional message

- **WHEN** a message is a normal promotion or newsletter with no sender mismatch, authentication failure, suspicious destination, or credential/payment request
- **THEN** the system does not show a phishing warning

#### Scenario: Sensitive but legitimate transaction message

- **WHEN** a message contains legitimate personal or financial activity but no phishing evidence
- **THEN** the sensitivity guardrail may require permission while the phishing result remains `low_risk`

### Requirement: Require corroborating evidence for high risk

The system SHALL classify a message as `high_risk` only when at least two independent strong security signals are present, or when one strong signal is corroborated by a separate medium security signal. A model language score alone MUST NOT produce `high_risk`.

#### Scenario: Single weak signal

- **WHEN** a message contains only generic urgency or only a model-based social-engineering signal
- **THEN** the system returns `low_risk` or `needs_attention`, but never `high_risk`

#### Scenario: Corroborated attack indicators

- **WHEN** a message combines indicators such as a reply-domain mismatch, explicit authentication failure, suspicious destination, or credential request with another independent security indicator
- **THEN** the system returns `high_risk` and explains both categories of evidence

### Requirement: Preserve privacy and permission boundaries

The system SHALL use the existing user-and-message-bound permission before any full-content phishing scan, and SHALL keep raw message bodies, snippets, credentials, tokens, and extracted sensitive values out of diagnostic logs.

#### Scenario: Full-content scan requires permission

- **WHEN** link or body analysis requires content not available during preflight
- **THEN** the system waits for valid permission before fetching or scanning that content

#### Scenario: Denied access

- **WHEN** the user keeps a flagged message closed
- **THEN** the system does not fetch the full body, attachments, or inline images for phishing analysis

### Requirement: Warn before risky interaction

The system SHALL show a clear warning before opening a message assessed as `high_risk` or `unable_to_verify`, and SHALL identify the risk level and reasons without displaying protected content. A `needs_attention` result MAY open after metadata preflight, but the system MUST scan the permitted full content before enabling links and show any resulting warning before navigation.

#### Scenario: User reviews a phishing warning

- **WHEN** a high-risk or unverified message is selected
- **THEN** the user sees the warning, reasons, and an explicit action to keep the message closed or open it knowingly

#### Scenario: Medium-risk message receives a post-open warning

- **WHEN** a message is assessed as `needs_attention` using bounded metadata
- **THEN** the system may retrieve it through the normal user open flow, performs the permitted full-content scan, and warns or blocks unsafe links before navigation

#### Scenario: High-risk message links

- **WHEN** a permitted full message is assessed as high risk after content scanning
- **THEN** links are disabled or clearly marked as unsafe until the user explicitly chooses to proceed with the individual link

### Requirement: Never perform unsolicited external actions

The phishing detector SHALL NOT automatically click links, download attachments, submit forms, reply, forward, delete, or quarantine a message.

#### Scenario: Message contains an actionable link

- **WHEN** phishing analysis finds a link in a message
- **THEN** the system reports or marks the link and waits for an explicit user action before any navigation
