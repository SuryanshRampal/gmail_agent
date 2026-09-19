import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : undefined;
databaseUrl?.searchParams.delete("sslmode");

export const db = new Pool({
  connectionString: databaseUrl?.toString(),
  ssl: databaseUrl ? { rejectUnauthorized: false } : undefined,
  max: 5,
});
