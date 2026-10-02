import { Pool } from "pg";

// A "pool" keeps a few database connections open and reuses them,
// which is much faster than connecting fresh for every request.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000, // give up after 5 seconds instead of hanging
});

// Creates the tasks table the first time the app starts.
// "IF NOT EXISTS" means running it again does nothing, so it's safe.
export async function setupDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}