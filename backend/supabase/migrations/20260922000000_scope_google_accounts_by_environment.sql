-- Keep Google OAuth tokens isolated by deployment environment.
-- This is additive: existing rows remain marked as legacy until each
-- environment reconnects and creates its own account record.
alter table next_auth.accounts
  add column if not exists oauth_environment text not null default 'legacy';

alter table next_auth.accounts
  drop constraint if exists accounts_oauth_environment_check;

alter table next_auth.accounts
  add constraint accounts_oauth_environment_check
  check (oauth_environment in ('legacy', 'local', 'preview', 'production'));

create index if not exists accounts_user_provider_environment_idx
  on next_auth.accounts ("userId", provider, oauth_environment);

create index if not exists accounts_provider_account_environment_idx
  on next_auth.accounts (provider, "providerAccountId", oauth_environment);
