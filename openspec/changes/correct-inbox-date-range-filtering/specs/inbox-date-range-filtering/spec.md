## Purpose

Ensure every Inbox date filter retrieves exactly the emails represented by its visible label, independent of month boundaries and the user’s time zone.

## ADDED Requirements

### Requirement: Last 30 days retrieves an inclusive rolling calendar window
The system SHALL interpret Last 30 days as the current local calendar day plus the preceding 29 local calendar days. It MUST retrieve inbox messages in that inclusive window and MUST NOT constrain this mode with a custom-date selection.

#### Scenario: Recent range on an ordinary day
- **WHEN** a user selects Last 30 days on 13 September in their local time zone
- **THEN** the Inbox contains messages dated from 15 August through 13 September, inclusive

#### Scenario: Recent range spans a month boundary
- **WHEN** a user selects Last 30 days on 5 March in their local time zone
- **THEN** the Inbox includes messages from 4 February through 5 March, inclusive

### Requirement: Custom date retrieves one complete local calendar day
The system SHALL retrieve all inbox messages whose received time falls on the selected calendar date in the user’s selected time zone. It MUST include both the first instant of that date and the final instant before the next local date.

#### Scenario: Single-date selection
- **WHEN** a user selects 1 September as a Custom date
- **THEN** the Inbox includes messages received on 1 September and excludes messages received on 31 August or 2 September in the selected time zone

### Requirement: Custom period includes both selected dates
The system SHALL retrieve all inbox messages from the start of the selected start date through the end of the selected end date, inclusive, in the user’s selected time zone.

#### Scenario: Multi-day period selection
- **WHEN** a user selects 1 September through 13 September as a Custom period
- **THEN** the Inbox includes messages on both 1 September and 13 September and excludes messages outside that period

#### Scenario: Cross-year period selection
- **WHEN** a user selects 30 December through 2 January as a Custom period
- **THEN** the Inbox includes messages across the year boundary through the end of 2 January

### Requirement: Displayed result matches the server-resolved range
The system SHALL use one resolved range definition for Gmail retrieval, the Inbox count, and displayed message list. It MUST NOT apply a second client-side filter that can exclude a message returned by the resolved server range.

#### Scenario: Boundary message is returned
- **WHEN** Gmail returns a message at the beginning or end of a resolved range
- **THEN** the Inbox displays and counts that message

### Requirement: Matching messages are browsed through quota-safe pages
The system SHALL make every message matching a resolved range accessible through bounded result pages. It MUST load the initial page without hydrating the entire range, provide a continuation when further results exist, and append each subsequent page without duplicate or missing messages.

#### Scenario: Large recent range
- **WHEN** Last 30 days contains more messages than fit in the initial result page
- **THEN** the Inbox displays the first page and offers a way to load the next matching page

#### Scenario: Loading subsequent pages
- **WHEN** a user requests the next page of a range with remaining results
- **THEN** the Inbox appends the next unique messages in the same resolved range

#### Scenario: All matching messages are reached
- **WHEN** a user continues loading pages until no continuation remains
- **THEN** every message in the resolved range has been made available without omission

### Requirement: Gmail throttling is handled without retry amplification
The system SHALL bound concurrent Gmail message-metadata retrieval and coordinate retries for transient Gmail quota responses. It MUST honor a provider-supplied retry delay when present and MUST return a recoverable error rather than silently omitting a message when a request cannot be completed.

#### Scenario: Gmail quota response
- **WHEN** Gmail returns a transient quota response while loading a result page
- **THEN** the system waits for the permitted retry window and retries within its configured request budget

#### Scenario: Retry budget is exhausted
- **WHEN** a page cannot be completed after its retry budget is exhausted
- **THEN** the Inbox reports that the page could not be loaded and preserves already loaded messages for a user-initiated retry

### Requirement: Invalid or incomplete ranges are not queried
The system SHALL reject malformed range inputs and SHALL not issue a Gmail search for a custom period until both dates are selected.

#### Scenario: Incomplete period selection
- **WHEN** a user has selected only the start date for a Custom period
- **THEN** the Inbox does not issue a range request until the end date is selected
