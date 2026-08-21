import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { user } from "./db/schema/index.js";
import { resolveWorkspace } from "./lib/workspace.js";

// Provisions (and seeds) the site owner's permanent workspace with the same
// fixture data every visitor workspace gets. Run once after deploy, or
// whenever ADMIN_EMAILS changes - idempotent, reuses the exact same
// provisioning path the live app uses, so re-running it once the workspace
// already exists is a no-op.

async function main() {
    const adminEmail = process.env.ADMIN_EMAILS?.split(",")[0]?.trim().toLowerCase();
    if (!adminEmail) throw new Error("Set ADMIN_EMAILS before running the seed script");

    const [admin] = await db.select({ id: user.id }).from(user).where(eq(user.email, adminEmail));

    if (!admin) {
        throw new Error(
            `No user found for ${adminEmail} yet - sign in with that Google/GitHub account once first ` +
            `(databaseHooks.user.create.before in lib/auth.ts grants it the admin role automatically), ` +
            `then re-run this script.`
        );
    }

    const workspace = await resolveWorkspace(admin.id, true);
    console.log(`Admin workspace ready: ${workspace.id}`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
