import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";

// A "real user" here means: signed in through an actual OAuth provider at
// least once (has a row in `account`). Every seeded/fixture student and
// faculty row was inserted directly by the seed scripts and never went
// through account-linking, so it has zero `account` rows - that's already
// a reliable, existing signal, not a new column to maintain.
//
// Run once (or again after a fresh DB provision - CREATE OR REPLACE VIEW is
// idempotent): npx tsx src/scripts/create-real-users-view.ts
//
// After that, query it directly from the Neon SQL console any time, no
// script needed:
//   select id, name, email, role, created_at from real_users;
async function main() {
    await db.execute(sql`
        create or replace view real_users as
        select u.*
        from "user" u
        where exists (select 1 from account a where a.user_id = u.id)
        order by u.created_at desc
    `);
    console.log("Created/updated view: real_users");

    const rows = await db.execute(sql`select id, name, email, role, created_at from real_users`);
    console.log(`real_users currently has ${rows.rows.length} row(s):`);
    console.table(rows.rows);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
