-- Replace the legacy one-account-per-provider constraint with one account per
-- provider, Google account, and deployment environment.
alter table next_auth.accounts
  drop constraint if exists provider_unique;

alter table next_auth.accounts
  add constraint provider_environment_unique
  unique (provider, "providerAccountId", oauth_environment);
