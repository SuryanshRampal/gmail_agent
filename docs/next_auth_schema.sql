-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE next_auth.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text,
  email text UNIQUE,
  emailVerified timestamp with time zone,
  image text,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE next_auth.sessions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  expires timestamp with time zone NOT NULL,
  sessionToken text NOT NULL UNIQUE,
  userId uuid,
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_userId_fkey FOREIGN KEY (userId) REFERENCES next_auth.users(id)
);
CREATE TABLE next_auth.accounts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  type text NOT NULL,
  provider text NOT NULL,
  providerAccountId text NOT NULL,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  oauth_token_secret text,
  oauth_token text,
  userId uuid,
  CONSTRAINT accounts_pkey PRIMARY KEY (id),
  CONSTRAINT accounts_userId_fkey FOREIGN KEY (userId) REFERENCES next_auth.users(id)
);
CREATE TABLE next_auth.verification_tokens (
  identifier text,
  token text NOT NULL,
  expires timestamp with time zone NOT NULL,
  CONSTRAINT verification_tokens_pkey PRIMARY KEY (token)
);
CREATE TABLE next_auth.user_profiles (
  id uuid NOT NULL,
  name text,
  email text,
  image text,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES next_auth.users(id)
);