## Purpose

Enable users to request a useful outbound email in natural language while keeping recipient correctness, user review, and explicit send authorization central to the experience.

## ADDED Requirements

### Requirement: The agent interprets an explicit email-writing request
The system SHALL accept an authenticated user request that asks it to write an email and SHALL identify the intended recipient, purpose, tone, and relevant constraints when those details are present. It MUST distinguish an email-writing request from an informational or summarization request.

#### Scenario: Complete writing request
- **WHEN** the user asks to email a known recipient with a purpose and tone
- **THEN** the system creates a draft using those requested details

#### Scenario: Non-email request
- **WHEN** the user asks a question about an email without asking to write or send one
- **THEN** the system does not create or send an outbound draft

### Requirement: The agent produces a reviewable draft
The system SHALL produce a draft containing recipient, subject, body, and a concise list of assumptions or missing details. The draft MUST be editable before sending and MUST not be sent as a side effect of generation.

#### Scenario: Draft generated
- **WHEN** the request contains enough information to write an email
- **THEN** the user sees an editable recipient, subject, and body before any send operation

#### Scenario: Missing required detail
- **WHEN** the request does not identify a recipient or the requested purpose is materially ambiguous
- **THEN** the system asks a clarification question and does not generate a sendable draft

### Requirement: Sending requires explicit confirmation
The system SHALL require an explicit confirmation action after the user reviews the final draft. Editing a draft SHALL invalidate any prior confirmation, and no natural-language request alone SHALL send an email.

#### Scenario: User confirms final draft
- **WHEN** the user confirms an unchanged reviewed draft
- **THEN** the system sends exactly that recipient, subject, and body through the authenticated Gmail account

#### Scenario: User edits after confirmation
- **WHEN** the user changes any sendable field after confirmation
- **THEN** the system requires confirmation again before sending

### Requirement: Recipient and content safety is enforced
The system SHALL validate recipient addresses and SHALL not invent or infer an address from an ambiguous name when no trusted address is available. The generated body SHALL be grounded in the user request and supplied email context, if any, and SHALL not claim actions were completed before send succeeds.

#### Scenario: Ambiguous recipient
- **WHEN** the user asks to email “Alex” but multiple or no trusted Alex addresses are available
- **THEN** the system asks the user to select or provide the exact address

#### Scenario: Invalid address
- **WHEN** the reviewed recipient is not a valid email address
- **THEN** the system blocks confirmation/send and explains what must be corrected

### Requirement: Send status is reliable and non-duplicating
The system SHALL show pending, success, and failure states for sending. A retry SHALL use an idempotency key for the same confirmed draft and MUST not create duplicate Gmail messages when the original send succeeded but the client did not receive the response.

#### Scenario: Successful send
- **WHEN** Gmail accepts the confirmed message
- **THEN** the system shows a success state with the recipient and subject and marks the draft as sent

#### Scenario: Recoverable send failure
- **WHEN** Gmail returns a transient send failure
- **THEN** the system preserves the reviewed draft and offers retry without requiring the user to recreate it

### Requirement: Authorization and privacy boundaries are preserved
The system SHALL use the authenticated user identity for draft and send operations, SHALL never expose OAuth tokens to the model or browser, and SHALL send only through the user’s connected Gmail account.

#### Scenario: Unauthenticated request
- **WHEN** a user without an authenticated Gmail session requests a draft or send
- **THEN** the system refuses the operation and requests authentication
