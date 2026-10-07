import type { Adapter, AdapterAccount, AdapterUser } from "next-auth/adapters";

import { db } from "@/lib/db";
import { encryptToken } from "@/lib/encryption";
import { oauthEnvironment } from "@/lib/oauth-environment";
import { upsertOAuthAccountTokens } from "@/lib/auth/oauth-account-store";

type DbUser = { id: string; name: string | null; email: string | null; emailverified: Date | null; image: string | null };
const toUser = (user: DbUser): AdapterUser => ({ id: user.id, name: user.name, email: user.email ?? "", emailVerified: user.emailverified, image: user.image });

// This adapter intentionally targets the existing docs/next_auth_schema.sql tables.
// Gmail access and refresh tokens are encrypted before they ever reach Postgres.
export const postgresAdapter: Adapter = {
  async createUser(user: Omit<AdapterUser, "id">) {
    const { rows } = await db.query<DbUser>("insert into next_auth.users (name, email, \"emailVerified\", image) values ($1, $2, $3, $4) returning id, name, email, \"emailVerified\" as emailverified, image", [user.name, user.email, user.emailVerified, user.image]);
    return toUser(rows[0]);
  },
  async getUser(id) {
    const { rows } = await db.query<DbUser>("select id, name, email, \"emailVerified\" as emailverified, image from next_auth.users where id = $1", [id]);
    return rows[0] ? toUser(rows[0]) : null;
  },
  async getUserByEmail(email) {
    const { rows } = await db.query<DbUser>("select id, name, email, \"emailVerified\" as emailverified, image from next_auth.users where email = $1", [email]);
    return rows[0] ? toUser(rows[0]) : null;
  },
  async getUserByAccount({ provider, providerAccountId }) {
    const { rows } = await db.query<DbUser>("select u.id, u.name, u.email, u.\"emailVerified\" as emailverified, u.image from next_auth.users u join next_auth.accounts a on a.\"userId\" = u.id where a.provider = $1 and a.\"providerAccountId\" = $2 and a.oauth_environment = $3", [provider, providerAccountId, oauthEnvironment]);
    return rows[0] ? toUser(rows[0]) : null;
  },
  async updateUser(user) {
    const { rows } = await db.query<DbUser>("update next_auth.users set name = coalesce($2, name), email = coalesce($3, email), \"emailVerified\" = coalesce($4, \"emailVerified\"), image = coalesce($5, image) where id = $1 returning id, name, email, \"emailVerified\" as emailverified, image", [user.id, user.name, user.email, user.emailVerified, user.image]);
    return toUser(rows[0]);
  },
  async linkAccount(account: AdapterAccount) {
    await upsertOAuthAccountTokens(db, encryptToken, account, oauthEnvironment);
  },
  async unlinkAccount({ provider, providerAccountId }: Pick<AdapterAccount, "provider" | "providerAccountId">) {
    await db.query("delete from next_auth.accounts where provider = $1 and \"providerAccountId\" = $2 and oauth_environment = $3", [provider, providerAccountId, oauthEnvironment]);
  },
  async createSession() { throw new Error("Database sessions are disabled; JWT sessions are used."); },
  async getSessionAndUser() { return null; },
  async updateSession() { return null; },
  async deleteSession() {},
};
