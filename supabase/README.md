# Supabase

Place generated, reviewed migrations in `migrations/` after the PRD establishes
the data model. Application tables in `public` must have Row Level Security
enabled and policies matching the ownership model. New tables also need explicit
Data API exposure if the frontend will access them directly.
