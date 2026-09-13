## Context

See proposal.md for motivation. The current dashboard always appends `from` and `to` query parameters from its date-picker state, including for the Recent mode. The Gmail integration then gives supplied dates precedence over the Recent query, while the UI separately filters returned messages using browser dates. This creates two conflicting range definitions.

## Goals / Non-Goals

**Goals:**

- Resolve each selected filter to one inclusive local-date window before retrieval.
- Pass only the parameters relevant to that mode.
- Use unambiguous inclusive/exclusive instants when querying Gmail and retain exactly the server-returned set in the UI.
- Make large date windows browseable without exceeding Gmail’s per-user query-cost quota.
- Cover date arithmetic and request construction without requiring live Gmail credentials.

**Non-Goals:**

- Change Gmail labels or the contents of individual message rendering.
- Persist a user time-zone preference beyond the browser time zone used for a request.
- Redefine Gmail’s message timestamp or alter Gmail’s server-side search behavior outside the selected range.

## Decisions

### Resolve ranges in the browser’s time zone and send explicit boundaries

The dashboard will derive a start-of-day and exclusive end-of-day boundary from the browser’s selected dates and include the browser IANA time-zone identifier with the request. The server will convert those calendar boundaries into the Gmail query form. This makes the displayed calendar and the retrieved interval use the same time-zone interpretation.

Using date-only Gmail query operands was considered, but their interpretation can differ from the user’s local date. Passing custom dates for every mode was rejected because it is the source of the current Recent-mode defect.

### Use an exclusive end boundary

The server will query for timestamps greater than or equal to the start and strictly before the next local day after the selected end date. An exclusive upper bound prevents loss of messages late on the selected final day and avoids overlapping adjacent ranges.

An inclusive end-of-day timestamp was rejected because sub-second precision and daylight-saving changes make it error-prone.

### Treat the server result as authoritative

After a successful range request, the dashboard will render and count the returned messages directly. The client will not repeat date filtering. This avoids browser parsing of Gmail Date headers producing a different result from the Gmail search query.

### Page metadata hydration behind opaque continuations

The messages route will return a bounded page and an opaque continuation instead of resolving every matching message before responding. The continuation preserves the resolved range and Gmail list cursor, so later pages cannot drift into a different filter. The dashboard will append pages on explicit user request and reset the page state when a range changes.

Gmail’s list endpoint alone cannot supply the sender and subject needed for the Inbox UI, so metadata retrieval remains necessary. Fetching all metadata in one request was rejected because it exceeds Gmail’s Total Query Cost quota. Batch endpoints were also rejected as the primary mitigation because Gmail still charges quota per contained request.

### Shared, bounded Gmail request budget

Metadata requests for a page will use a small bounded concurrency and a page-scoped retry budget. A quota response pauses new metadata requests, honors `Retry-After` where available, and retries only the failed work; it will not cause unrelated requests to multiply their retry attempts.

The current independent per-request retry loop was rejected because parallel retries turn one quota event into sustained quota pressure and long request latency.

### Test the range resolver separately from Gmail transport

Date-window arithmetic and API request construction will be covered with deterministic unit tests for regular, month-boundary, year-boundary, and inclusive-end cases. Gmail transport tests will assert that the resolved bounds are encoded in the search request without requiring a live account.

## Risks / Trade-offs

- [Browser and Gmail account time zones differ] → The request will carry the browser time zone used to label the calendar; the UI can later disclose that zone if user feedback shows a need.
- [Gmail’s search grammar has edge-case timestamp behavior] → Use explicit start and exclusive-end instants and add boundary fixtures before release.
- [A very large range takes several user interactions to browse] → Show loaded progress and a clear “Load more” control while retaining all messages through continuations.
- [Gmail quota is temporarily exhausted] → Preserve loaded pages, display a recoverable page-level error, and retry only after a bounded backoff.
- [Changing range semantics surprises users who assumed a rolling 720-hour interval] → The visible label and calendar convention use calendar days; document this as today plus the preceding 29 dates.

## Migration Plan

1. Release the range resolver, continuation API, and dashboard page state together.
2. Verify a controlled mailbox with messages on both boundaries and more than one page for each applicable mode.
3. Monitor query logs for resolved range, page size, continuation use, and quota backoff without logging message content.
4. Roll back by restoring the prior bounded page size if Gmail query compatibility issues appear.
