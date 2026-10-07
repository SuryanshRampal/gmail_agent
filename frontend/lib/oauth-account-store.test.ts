import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's native TypeScript runner requires the .ts extension.
import { clearOAuthAccountTokens, upsertOAuthAccountTokens } from "./auth/oauth-account-store.ts";

type CapturedQuery = { text: string; values?: unknown[] };

const fakeDatabase = () => {
  const queries: CapturedQuery[] = [];
  return {
    queries,
    database: {
      async query(text: string, values?: unknown[]) {
        queries.push({ text, values });
        return {};
      },
    },
  };
};

test("OAuth callback upsert encrypts tokens and scopes the record to its environment", async () => {
  const { database, queries } = fakeDatabase();
  await upsertOAuthAccountTokens(database, (value) => `encrypted:${value}`, {
    type: "oauth",
    provider: "google",
    providerAccountId: "google-account-1",
    refresh_token: "new-refresh-token",
    access_token: "new-access-token",
    expires_at: 123456,
    token_type: "Bearer",
    scope: "openid email",
    id_token: "new-id-token",
    session_state: "state",
    userId: "user-1",
  }, "preview");

  assert.equal(queries.length, 1);
  assert.match(queries[0].text, /on conflict \(provider, "providerAccountId", oauth_environment\)/);
  assert.match(queries[0].text, /refresh_token = coalesce\(excluded\.refresh_token, accounts\.refresh_token\)/);
  assert.deepEqual(queries[0].values, [
    "oauth",
    "google",
    "google-account-1",
    "encrypted:new-refresh-token",
    "encrypted:new-access-token",
    123456,
    "Bearer",
    "openid email",
    "encrypted:new-id-token",
    "state",
    "user-1",
    "preview",
  ]);
});

test("OAuth callback upsert does not erase a refresh token when Google omits one", async () => {
  const { database, queries } = fakeDatabase();
  await upsertOAuthAccountTokens(database, (value) => `encrypted:${value}`, {
    type: "oauth",
    provider: "google",
    providerAccountId: "google-account-1",
    access_token: "new-access-token",
    userId: "user-1",
  }, "production");

  assert.equal(queries[0].values?.[3], null);
  assert.equal(queries[0].values?.[4], "encrypted:new-access-token");
  assert.equal(queries[0].values?.[11], "production");
});

test("revoked-token cleanup only clears the user's provider record in one environment", async () => {
  const { database, queries } = fakeDatabase();
  await clearOAuthAccountTokens(database, "user-1", "google", "local");

  assert.equal(queries.length, 1);
  assert.match(queries[0].text, /set access_token = null, refresh_token = null, expires_at = null/);
  assert.deepEqual(queries[0].values, ["user-1", "google", "local"]);
});
