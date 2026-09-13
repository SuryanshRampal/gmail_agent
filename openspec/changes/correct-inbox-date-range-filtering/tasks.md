## 1. Range resolution contract

- [x] 1.1 Add a shared, deterministic range resolver for Recent, Custom date, and Custom period modes that yields inclusive start and exclusive end boundaries; verify unit coverage for ordinary, month-boundary, and year-boundary dates.
- [x] 1.2 Update the dashboard to submit only the parameters belonging to the selected mode, include the browser time zone, and render the API-returned messages without a second date filter; verify Last 30 days no longer submits the date picker’s default values.

## 2. Gmail retrieval accuracy and quota control

- [x] 2.1 Validate range API inputs, reject malformed or incomplete custom ranges, and convert valid resolved boundaries to Gmail search operands; verify route-level tests cover invalid input and the resolved query for each mode.
- [x] 2.2 Add opaque range continuations and bounded message-metadata pages; verify mocked Gmail requests include boundary messages, exclude adjacent-range messages, and preserve the resolved range across page requests.
- [x] 2.3 Replace independent message retry loops with a page-scoped request budget that limits concurrency, honors `Retry-After`, and retries only transient quota failures; verify 403/429 fixtures do not issue concurrent retry bursts.

## 3. Inbox continuation experience

- [x] 3.1 Add dashboard page state that resets on a range change, appends successful continuation pages, and shows loaded progress plus a Load more control; verify previously loaded messages remain visible if a later page fails.
- [x] 3.2 Add a recoverable, page-level quota error state with an explicit retry action; verify no matching message is silently dropped when a page request fails.

## 4. Verification and release checks

- [x] 4.1 Add regression tests for the current defect: Recent mode on 13 September must query 15 August through 13 September, rather than only 13 September; verify the test fails before and passes after the correction.
- [ ] 4.2 Run frontend lint/build and backend tests, then manually verify a mailbox with messages on both range boundaries and a multi-page Last 30 days result.
