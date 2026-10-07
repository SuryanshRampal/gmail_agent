export type OAuthAccountTokens = {
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token?: string | null;
  access_token?: string | null;
  expires_at?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
  session_state?: string | null;
  userId: string;
};

type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<unknown>;
};

type Encrypt = (value: string) => string;

// NextAuth does not call adapter.linkAccount again when an OAuth account is
// already linked. Reusing this upsert from the post-callback signIn event makes
// sure a newly issued Google refresh token replaces a revoked stored token.
export async function upsertOAuthAccountTokens(
  database: Queryable,
  encrypt: Encrypt,
  account: OAuthAccountTokens,
  oauthEnvironment: string,
) {
  const values = [
    account.type,
    account.provider,
    account.providerAccountId,
    account.refresh_token ? encrypt(account.refresh_token) : null,
    account.access_token ? encrypt(account.access_token) : null,
    account.expires_at ?? null,
    account.token_type ?? null,
    account.scope ?? null,
    account.id_token ? encrypt(account.id_token) : null,
    account.session_state ?? null,
    account.userId,
    oauthEnvironment,
  ];

  await database.query(
    `insert into next_auth.accounts as accounts
      (type, provider, "providerAccountId", refresh_token, access_token, expires_at, token_type, scope, id_token, session_state, "userId", oauth_environment)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict (provider, "providerAccountId", oauth_environment) do update set
       type = excluded.type,
       refresh_token = coalesce(excluded.refresh_token, accounts.refresh_token),
       access_token = coalesce(excluded.access_token, accounts.access_token),
       expires_at = excluded.expires_at,
       token_type = excluded.token_type,
       scope = excluded.scope,
       id_token = coalesce(excluded.id_token, accounts.id_token),
       session_state = excluded.session_state,
       "userId" = excluded."userId"`,
    values,
  );
}

export async function clearOAuthAccountTokens(
  database: Queryable,
  userId: string,
  provider: string,
  oauthEnvironment: string,
) {
  await database.query(
    `update next_auth.accounts
     set access_token = null, refresh_token = null, expires_at = null
     where "userId" = $1 and provider = $2 and oauth_environment = $3`,
    [userId, provider, oauthEnvironment],
  );
}
