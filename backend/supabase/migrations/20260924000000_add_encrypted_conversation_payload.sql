-- Store new conversation payloads outside the readable legacy JSON column.
-- Existing rows remain readable through "Logs" during the migration period.
alter table logs.conversation_events
  add column if not exists "EncryptedLogs" text;

alter table logs.conversation_events
  alter column "Logs" drop not null;

alter table logs.conversation_events
  add constraint conversation_events_payload_present
  check ("Logs" is not null or "EncryptedLogs" is not null);
