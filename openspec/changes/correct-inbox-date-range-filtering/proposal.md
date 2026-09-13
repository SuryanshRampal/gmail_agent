## Why

The Inbox currently labels its default view “Last 30 days,” but it sends the component’s default custom-date values with that request. Because the API prioritizes supplied dates, the initial view can query only the current day rather than the intended 30-day window. Date-only Gmail search boundaries can also be ambiguous around time zones and range endpoints. Additionally, hydrating every matching message in one request exhausts Gmail’s per-user Total Query Cost quota for larger date windows.

## What Changes

- Define an exact, user-visible meaning for Last 30 days: today plus the preceding 29 local calendar days, inclusive.
- Make the three range modes mutually exclusive at the API boundary: Last 30 days must not carry custom-date parameters.
- Send explicit, timezone-aware inclusive/exclusive range boundaries for Custom date and Custom period, including the final selected day.
- Make the Gmail query use the resolved range boundaries consistently and remove the redundant client-side date filtering that can disagree with the server result.
- Return matching messages through quota-safe continuation pages so every result remains accessible without attempting to hydrate an entire 30-day window at once.
- Coordinate Gmail retries through a bounded request budget and honor provider backoff signals to avoid retry amplification.
- Add targeted coverage for mode selection, month/year boundaries, inclusive end dates, and timezone offsets.

## Capabilities

### New Capabilities

- `inbox-date-range-filtering`: Defines accurate, consistent, and quota-safe Gmail inbox retrieval for recent, single-date, and date-period filters.

### Modified Capabilities

- None.

## Impact

- Affected frontend: dashboard range state, continuation UI, and messages API request construction.
- Affected backend: Gmail messages route, Gmail search query construction, continuation tokens, and retry coordination.
- Affected external system: Gmail search query semantics; no new dependency or credential scope is required.
