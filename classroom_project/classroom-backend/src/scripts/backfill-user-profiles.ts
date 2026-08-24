import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";

// One-off repair for accounts created before lib/auth.ts started rejecting
// sign-in when a provider has no verified email (and before the GitHub
// provider's own /user/emails fallback existed in whatever Better Auth
// version created the row). Detects rows with an empty name/email - `email`
// and `name` are NOT NULL columns, so a broken row shows up as an empty
// string, not null - and repairs GitHub rows via the emails API using the
// account's own stored access token, which this app keeps unencrypted (no
// secondaryStorage/token-encryption plugin configured in lib/auth.ts).
//
// Run: npx tsx src/scripts/backfill-user-profiles.ts

type BrokenUser = {
    id: string;
    name: string;
    email: string;
};

type GithubEmail = { email: string; primary: boolean; verified: boolean };

async function repairGithubUser(user: BrokenUser): Promise<"repaired" | "no-verified-email" | "no-account" | "error"> {
    const [account] = await db.execute<{ access_token: string | null; account_id: string }>(sql`
        select access_token, account_id from account
        where user_id = ${user.id} and provider_id = 'github'
        limit 1
    `).then((r) => r.rows);

    if (!account?.access_token) return "no-account";

    const res = await fetch("https://api.github.com/user/emails", {
        headers: {
            Authorization: `Bearer ${account.access_token}`,
            "User-Agent": "classroom-backend-backfill",
        },
    });
    if (!res.ok) return "error";

    const emails = (await res.json()) as GithubEmail[];
    const verified = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
    if (!verified) return "no-verified-email";

    const nameFallback = user.name || account.account_id; // account_id is the GitHub login for this provider

    await db.execute(sql`
        update "user"
        set email = ${verified.email},
            "emailVerified" = true,
            name = case when trim(name) = '' then ${nameFallback} else name end
        where id = ${user.id}
    `);
    return "repaired";
}

async function main() {
    const broken = await db.execute<BrokenUser>(sql`
        select id, name, email from "user" where trim(name) = '' or trim(email) = ''
    `).then((r) => r.rows);

    console.log(`Found ${broken.length} user row(s) with an empty name or email.`);
    if (broken.length === 0) return;

    let repaired = 0;
    let stillBroken = 0;
    for (const user of broken) {
        const result = await repairGithubUser(user);
        if (result === "repaired") {
            repaired++;
            console.log(`  repaired ${user.id}`);
        } else {
            stillBroken++;
            console.log(`  still broken ${user.id}: ${result}`);
        }
    }
    console.log(`Repaired: ${repaired}. Still broken (needs manual review): ${stillBroken}.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
