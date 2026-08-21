import "dotenv/config";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { user, demoWorkspaces } from "../db/schema/index.js";
import { resolveWorkspace } from "../lib/workspace.js";

// Standalone verification, not part of an automated suite (none exists in this
// repo yet) - run manually with `tsx src/scripts/verify-workspace-provisioning-race.ts`.
// Fires N concurrent resolveWorkspace() calls for a brand-new user and checks
// that exactly one workspace row was created and every call returned it - the
// scenario the unique(user_id) constraint + 23505 catch in lib/workspace.ts
// exists to handle (e.g. two browser tabs both loading the dashboard right
// after first sign-in).

const CONCURRENCY = 8;

async function main() {
    const testUserId = randomUUID();
    await db.insert(user).values({
        id: testUserId,
        name: "Race Test User",
        email: `race-test-${testUserId}@example.invalid`,
        role: "student",
    });

    try {
        const results = await Promise.all(
            Array.from({ length: CONCURRENCY }, () => resolveWorkspace(testUserId, false))
        );

        const ids = new Set(results.map((r) => r.id));
        const rows = await db.select().from(demoWorkspaces).where(eq(demoWorkspaces.userId, testUserId));

        console.log(`${CONCURRENCY} concurrent calls returned ${ids.size} distinct workspace id(s)`);
        console.log(`${rows.length} workspace row(s) actually exist for this user`);

        if (ids.size !== 1 || rows.length !== 1) {
            throw new Error("FAIL: expected exactly one workspace to survive the race");
        }

        console.log("PASS");
    } finally {
        await db.delete(user).where(eq(user.id, testUserId));
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
