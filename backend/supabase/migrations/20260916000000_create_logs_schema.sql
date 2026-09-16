-- Conversation log events for the NextAuth-backed application.
-- SessionID identifies a conversation; UserID binds it to the authenticated user.
create schema if not exists logs;

create table if not exists logs.conversation_events (
  "UUID" uuid primary key default gen_random_uuid(),
  "SessionID" uuid not null,
  "UserID" uuid not null references next_auth.users (id) on delete cascade,
  "Logs" jsonb not null,
  created_at timestamptz not null default now(),
  constraint conversation_events_logs_object check (jsonb_typeof("Logs") = 'object')
);

create index if not exists conversation_events_user_session_created_idx
  on logs.conversation_events ("UserID", "SessionID", created_at, "UUID");

alter table logs.conversation_events enable row level security;

-- The application uses its server-side NextAuth session and a private DATABASE_URL,
-- rather than Supabase Auth JWTs. Keep this schema unavailable to Data API roles.
revoke all on schema logs from public, anon, authenticated;
revoke all on table logs.conversation_events from public, anon, authenticated;
