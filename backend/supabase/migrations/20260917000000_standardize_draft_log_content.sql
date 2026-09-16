-- Assistant draft payloads are stored as nested JSON rather than JSON text.
update logs.conversation_events
set "Logs" = jsonb_set(
  "Logs",
  '{message,content}',
  ("Logs"->'message'->>'content')::jsonb,
  false
)
where "Logs"->>'type' = 'assistant'
  and jsonb_typeof("Logs"->'message'->'content') = 'string'
  and pg_input_is_valid("Logs"->'message'->>'content', 'jsonb');
