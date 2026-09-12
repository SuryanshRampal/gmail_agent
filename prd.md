# Gmail AI Agent — MVP PRD

## 1. Product Overview

Build the first version of an AI agent web application that allows users to connect their Gmail account and perform basic email tasks through a simple authenticated interface.

The first agent will support two core capabilities:

1. **Read and summarize emails**
2. **Send emails**

The application should be built with:

* **Next.js**
* **NextAuth**
* **Supabase / PostgreSQL**
* **shadcn/ui**
* Gmail API / Google OAuth
* Encrypted OAuth access and refresh tokens
* Environment variables for secrets and configuration

This is an MVP. Prioritize a clean architecture, secure authentication/token handling, and a polished frontend over implementing advanced AI-agent behavior.

---

# 2. Important Existing Files

Before making any changes, inspect the following files:

### `DESIGN.md`

This is the source of truth for the application's visual design.

Follow its:

* Colors
* Typography
* Spacing
* Components
* Layout
* Interaction patterns
* Dark/light mode requirements
* UI conventions

Do not introduce a competing design system.

Use **shadcn/ui** components wherever appropriate.

### `docs/next_auth_schema.sql`

This contains the database schema relevant to NextAuth.

Read and understand this file before implementing authentication or database queries.

Do not create a conflicting authentication schema.

### `.env`

The project already contains environment configuration, including the database/schema configuration and secrets.

Do not hard-code credentials, API keys, encryption keys, database URLs, or OAuth secrets.

Never expose server-side secrets to the client.

---

# 3. MVP Goals

The MVP should allow a user to:

1. Visit the application.
2. Sign in with Google.
3. Grant Gmail permissions.
4. Have their OAuth credentials securely stored.
5. Remain authenticated across sessions.
6. Open the Gmail agent dashboard.
7. View emails from their Gmail account.
8. Read an email.
9. Generate/view an AI summary of an email.
10. Compose and send an email.
11. Sign out.

The initial implementation should establish the architecture so additional agents/tools can be added later.

---

# 4. Authentication

## 4.1 Google Login

Use Google OAuth through NextAuth.

The authentication flow should:

1. User clicks **Continue with Google**.
2. User is redirected to Google's OAuth consent screen.
3. User grants the required Gmail permissions.
4. Google redirects back to the application.
5. NextAuth creates/authenticates the user.
6. Gmail OAuth tokens are securely persisted.
7. User is redirected to the application dashboard.

---

# 5. Gmail OAuth Scopes

Request only the minimum scopes required for the MVP.

The MVP requires the ability to:

* Read Gmail messages.
* Send Gmail messages.

Use appropriate Gmail API scopes for these operations.

Avoid requesting unnecessary Google account permissions.

The OAuth implementation should support refresh tokens so the application can obtain new access tokens when the current access token expires.

---

# 6. Token Storage & Security

OAuth tokens must **never be stored in plaintext**.

The application must store:

* Access token
* Refresh token
* Token expiry information
* Provider/account information as required

Access and refresh tokens must be encrypted before being persisted to the database.

## Encryption

Use an authenticated encryption mechanism such as **AES-256-GCM** or another modern authenticated encryption scheme.

The encryption key must come from an environment variable.

For example:

```env
TOKEN_ENCRYPTION_KEY=...
```

Do not hard-code the key.

Do not commit the key to git.

Do not expose the key to browser/client-side code.

Encryption and decryption must happen exclusively on the server.

Create a small reusable server-side encryption utility rather than duplicating encryption logic throughout the application.

Example conceptual API:

```ts
encryptToken(token)
decryptToken(encryptedToken)
```

The exact implementation should follow the existing project's conventions.

---

# 7. Token Refresh

The Gmail integration must handle expired access tokens.

When a Gmail API request requires authentication:

1. Retrieve the user's encrypted tokens.
2. Decrypt them server-side.
3. Determine whether the access token is still valid.
4. If valid, use it.
5. If expired, use the refresh token to obtain a new access token.
6. Encrypt and persist the new access token.
7. Continue the original Gmail operation.

The user should not need to manually reconnect Gmail simply because an access token expired.

If the refresh token is invalid/revoked, return a clear authentication error and provide a way for the user to reconnect their Gmail account.

---

# 8. Database

Use the existing Supabase/PostgreSQL database.

The authentication-related schema should follow:

```text
docs/next_auth_schema.sql
```

Before implementing database operations:

* Inspect the existing schema.
* Reuse existing tables where appropriate.
* Do not duplicate NextAuth tables.
* Do not create unnecessary tables.

If additional Gmail-specific persistence is required, add the smallest possible schema extension.

Any new migration/schema changes should be clearly documented.

---

# 9. Application Architecture

Keep authentication, Gmail API access, token management, and UI concerns separated.

Suggested structure:

```text
app/
  ...
  
components/
  ...
  
lib/
  auth/
  gmail/
  encryption/
  ...
  
server/
  ...
  
docs/
  next_auth_schema.sql
```

The exact directory structure can follow the existing project conventions.

The important requirement is that:

### Client

Responsible for:

* Rendering UI
* User interactions
* Loading states
* Error states
* Calling server-side functionality

### Server

Responsible for:

* OAuth/token handling
* Token encryption/decryption
* Gmail API calls
* Refreshing access tokens
* Sending emails
* Reading emails
* AI summarization

The browser must never receive:

* Refresh tokens
* Encryption keys
* Database credentials
* Google client secrets

---

# 10. Gmail Agent

Create a Gmail integration/service layer that abstracts Gmail API operations from the UI.

The frontend should not directly interact with the Gmail API.

Example conceptual interface:

```ts
getEmails(userId, options)
getEmail(userId, messageId)
summarizeEmail(userId, messageId)
sendEmail(userId, email)
```

The exact API can differ based on the project's architecture.

---

# 11. Task 1 — Read & Summarize Emails

The user should be able to see their recent Gmail messages.

The initial inbox UI should display useful metadata such as:

* Sender
* Subject
* Received date/time
* Read/unread state
* Short preview/snippet

Clicking an email should open an email detail view.

The email detail view should display:

* Sender
* Recipients
* Subject
* Timestamp
* Email body

Provide a **Summarize** action.

When the user selects **Summarize**:

1. Fetch the email content server-side.
2. Extract/clean the relevant email text.
3. Send the content to the configured AI model.
4. Generate a concise summary.
5. Display the summary in the UI.

The summary should prioritize:

* Main point
* Important information
* Action items
* Deadlines
* Decisions/questions

Avoid unnecessary verbosity.

---

# 12. Task 2 — Send Email

Provide a simple compose interface.

The user should be able to enter:

* Recipient
* Subject
* Message body

Example:

```text
To: user@example.com

Subject: Meeting tomorrow

Body:
Hi John,

Just confirming our meeting tomorrow at 10 AM.

Thanks
```

The UI should provide a clear **Send** action.

On send:

1. Validate the input.
2. Authenticate the Gmail request server-side.
3. Construct a valid Gmail message.
4. Send it through the Gmail API.
5. Display success/failure feedback.

Do not expose Gmail access/refresh tokens to the browser.

---

# 13. Dashboard

After successful authentication, the user should land on a Gmail agent dashboard.

The dashboard should include:

### Header

* Application/agent name
* User account/avatar
* Sign out action

### Main navigation

At minimum:

* Inbox
* Compose

Additional navigation can be added if it naturally fits the design in `DESIGN.md`.

---

# 14. Inbox UI

The inbox should feel like an AI-agent interface rather than simply cloning Gmail.

Each email row should make it easy to:

* Identify the sender
* Identify the subject
* Preview the message
* Open the message
* Summarize the message

Use shadcn/ui components and follow `DESIGN.md`.

Include appropriate:

* Loading states
* Empty states
* Error states
* Skeletons
* Success feedback

---

# 15. Email Detail UI

The email detail page/panel should provide:

```text
Sender
Recipient(s)
Subject
Date

--------------------------------

Email content

--------------------------------

[ Summarize ]
```

When summarization is running:

```text
Generating summary...
```

After completion:

```text
AI Summary

[summary]
```

The summary should be visually distinct from the original email.

---

# 16. Compose UI

Create a clean compose experience using shadcn/ui.

Fields:

* To
* Subject
* Body

Actions:

* Send
* Cancel

Validate:

* Recipient is present and valid.
* Subject/body requirements according to the chosen UX.
* Prevent accidental duplicate submissions.

Show:

* Sending state
* Success state
* Error state

---

# 17. Error Handling

Errors should be user-friendly.

Do not expose:

* Stack traces
* OAuth credentials
* Encryption details
* Database errors
* Internal implementation details

Examples:

### Gmail disconnected

> Your Gmail connection has expired. Please reconnect your account.

### Gmail API error

> We couldn't access your Gmail right now. Please try again.

### Send failure

> We couldn't send the email. Please try again.

### Summarization failure

> We couldn't generate a summary for this email. Please try again.

Server logs may contain more detailed diagnostic information.

---

# 18. Loading & Empty States

Every asynchronous operation should have an appropriate loading state.

Examples:

### Inbox

Use skeleton rows while emails are loading.

### Email

Show a loading state while fetching the message.

### Summary

Show a summary-generation loading state.

### Send

Disable the send button while the request is in progress.

### Empty inbox

Provide a useful empty state rather than showing a blank page.

---

# 19. Security Requirements

The following are mandatory:

* Never expose OAuth refresh tokens to the client.
* Never expose encryption keys to the client.
* Never hard-code secrets.
* Never commit `.env` secrets.
* Encrypt persisted OAuth tokens.
* Decrypt tokens only server-side.
* Validate authenticated user access before Gmail operations.
* Never allow one user to access another user's Gmail data.
* Validate API inputs server-side.
* Do not trust user-provided user IDs.
* Use the authenticated session as the source of truth for the current user.
* Request only required Google OAuth scopes.

---

# 20. Authorization

Every Gmail operation must be tied to the currently authenticated user.

Do not accept a client-provided `userId` and blindly use it.

Instead:

```text
Request
   ↓
Authenticated session
   ↓
Current user ID
   ↓
Encrypted Gmail credentials
   ↓
Gmail API
```

A user must only be able to access their own Gmail account.

---

# 21. AI Layer

Keep the AI implementation separate from Gmail API logic.

For example:

```text
Gmail Service
     ↓
Email Content
     ↓
AI Service
     ↓
Summary
```

Do not tightly couple the AI provider to the Gmail service.

The AI provider/model should be configurable through environment variables where practical.

For the MVP, only email summarization is required.

Do not implement autonomous email actions yet.

---

# 22. Agent Architecture

Although the MVP only has two capabilities, structure the code so future agent tools can be added.

Conceptually:

```text
Gmail Agent
│
├── Read Email
├── Summarize Email
└── Send Email
```

Future functionality may include:

```text
├── Search Emails
├── Draft Reply
├── Reply to Email
├── Create Labels
├── Archive Email
└── Schedule Email
```

Do not implement these future capabilities unless required for the MVP.

---

# 23. UX Principles

The application should feel:

* Fast
* Minimal
* Modern
* AI-native
* Trustworthy
* Easy to understand

Avoid unnecessary UI complexity.

The user should always understand:

1. Which Gmail account is connected.
2. What the agent is doing.
3. When an operation is loading.
4. Whether an operation succeeded.
5. When Gmail authorization needs attention.

Follow `DESIGN.md` instead of inventing visual styles.

---

# 24. Responsive Design

The application should work well on:

* Desktop
* Tablet
* Mobile

Prioritize desktop initially, but avoid layouts that fundamentally break on smaller screens.

Use responsive Tailwind/shadcn patterns.

---

# 25. Initial Routes

The exact routing structure can follow the existing application, but the MVP should provide equivalents of:

```text
/
 /login
 /dashboard
 /inbox
 /inbox/[messageId]
 /compose
```

If a better structure already exists in the project, reuse it.

Unauthenticated users should not be able to access authenticated routes.

---

# 26. Authentication States

Support these states:

### Logged out

Show the login page.

### Authenticating

Show an appropriate loading state.

### Authenticated + Gmail connected

Show the Gmail dashboard.

### Authenticated + Gmail disconnected

Show a reconnect/connect Gmail state.

### Gmail token expired

Automatically refresh when possible.

### Gmail authorization revoked

Prompt the user to reconnect.

---

# 27. Implementation Priorities

Implement in this order:

### Phase 1 — Project understanding

1. Inspect the existing repository.
2. Read `DESIGN.md`.
3. Read `docs/next_auth_schema.sql`.
4. Inspect the current Next.js structure.
5. Inspect `.env` variable names without exposing secret values.
6. Understand the existing Supabase setup.
7. Understand the existing NextAuth setup, if any.

### Phase 2 — Authentication

1. Configure Google OAuth.
2. Configure NextAuth.
3. Connect authentication to the existing schema.
4. Persist user/session/account data correctly.
5. Verify login/logout.
6. Verify authenticated route protection.

### Phase 3 — Gmail credentials

1. Request Gmail scopes.
2. Capture OAuth tokens.
3. Encrypt access/refresh tokens.
4. Persist encrypted tokens.
5. Implement server-side token decryption.
6. Implement token refresh.
7. Handle revoked credentials.

### Phase 4 — Gmail read

1. Create Gmail service.
2. Fetch inbox messages.
3. Display messages.
4. Fetch individual messages.
5. Display email content.

### Phase 5 — AI summarization

1. Create AI service abstraction.
2. Send email content to the AI model.
3. Return concise summary.
4. Display summary.
5. Handle failures/loading states.

### Phase 6 — Send email

1. Build compose UI.
2. Validate input.
3. Create Gmail message.
4. Send through Gmail API.
5. Handle success/error states.

### Phase 7 — Polish

1. Apply `DESIGN.md`.
2. Improve loading states.
3. Improve empty states.
4. Improve error handling.
5. Check responsive behavior.
6. Check security boundaries.
7. Remove unnecessary code.
8. Run lint/type checks/tests.

---

# 28. Testing Requirements

Before considering the MVP complete, verify:

## Authentication

* [ ] User can sign in with Google.
* [ ] User can sign out.
* [ ] Session persists after refresh.
* [ ] Protected routes reject unauthenticated users.
* [ ] User information is persisted correctly.

## Gmail OAuth

* [ ] Gmail permissions are requested.
* [ ] Access token is encrypted before persistence.
* [ ] Refresh token is encrypted before persistence.
* [ ] Encryption key is never exposed client-side.
* [ ] Access token refresh works.
* [ ] Revoked/invalid credentials are handled.

## Gmail Read

* [ ] Inbox loads.
* [ ] Email metadata displays correctly.
* [ ] Individual emails can be opened.
* [ ] Email body renders safely.
* [ ] User cannot access another user's email.

## Summarization

* [ ] Summary action works.
* [ ] Loading state works.
* [ ] Summary is displayed correctly.
* [ ] AI errors are handled gracefully.

## Send

* [ ] Compose form works.
* [ ] Invalid recipients are rejected.
* [ ] Email sends successfully.
* [ ] Sending state prevents duplicate submissions.
* [ ] Errors are handled gracefully.

## UI

* [ ] UI follows `DESIGN.md`.
* [ ] shadcn/ui is used consistently.
* [ ] Mobile layout does not break.
* [ ] Loading states exist.
* [ ] Empty states exist.
* [ ] Error states exist.

---

# 29. Definition of Done

The MVP is complete when a new user can:

```text
Open application
      ↓
Sign in with Google
      ↓
Grant Gmail permissions
      ↓
Reach Gmail Agent dashboard
      ↓
View recent emails
      ↓
Open an email
      ↓
Generate an AI summary
      ↓
Compose an email
      ↓
Send the email
      ↓
Sign out
```

All OAuth credentials must remain securely encrypted and server-side throughout the entire flow.

The implementation must use the existing project conventions and must respect `DESIGN.md` and `docs/next_auth_schema.sql`.

---

# 30. Out of Scope

Do not implement the following in the MVP:

* Autonomous agent loops
* Automatic email replies
* Email deletion
* Email archiving
* Labels
* Gmail search
* Calendar integration
* Multiple email providers
* Slack integration
* Background email monitoring
* Scheduled email sending
* Complex agent memory
* Multi-agent orchestration
* Billing/subscriptions
* Team/workspace functionality
* Admin dashboard

These can be added later.

---

# 31. Development Principle

**Do not over-engineer the MVP.**

Prefer:

* Small services
* Clear boundaries
* Strong typing
* Server-side security
* Reusable components
* Simple APIs
* Existing project conventions

Before introducing a new abstraction, check whether the existing project already has an appropriate pattern.

Do not rewrite unrelated parts of the application.

Do not modify `DESIGN.md` unless explicitly requested.

Do not modify the existing authentication schema unless required.

When making schema changes, create a clear migration rather than silently changing the database structure.

---

# 32. First Implementation Task

Start by inspecting the repository and the following files:

```text
DESIGN.md
docs/next_auth_schema.sql
.env
package.json
```

Then inspect the existing Next.js, NextAuth, Supabase, and shadcn setup.

After understanding the existing codebase, implement the MVP incrementally.

**Do not ask for information that can be determined by inspecting the repository.**

If something is genuinely missing or ambiguous, make the smallest reasonable assumption and document it rather than blocking implementation.
