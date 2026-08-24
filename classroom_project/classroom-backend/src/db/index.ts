import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

// neon-http (the previous driver) explicitly throws "No transactions support
// in neon-http driver" - confirmed by reading its own source. That's what
// let workspace provisioning silently commit a partial seed on a race or a
// mid-seed error (see lib/workspace.ts): there was no way to wrap the
// multi-table insert in one atomic unit at all, only individually-committing
// statements. The Pool/WebSocket driver supports real interactive
// transactions (db.transaction(async (tx) => {...})), which is what makes
// that fix possible. Railway runs this as a long-lived process, not a
// serverless function - the cold-start cost neon-http exists to avoid on
// Vercel/Lambda-style hosts doesn't apply here, so there's no downside to
// holding a real pooled connection.
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);