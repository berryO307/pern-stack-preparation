import "dotenv/config";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { user, demoWorkspaces, departments } from "../db/schema/index.js";
import { sweepExpiredWorkspaces } from "../lib/cleanup.js";

// Standalone verification - run manually with
// `tsx src/scripts/verify-workspace-sweep.ts`. Creates one expired
// non-permanent workspace (with a dependent row, to check the cascade) and
// one expired-looking-but-permanent workspace, runs the real sweep, and
// checks that only the non-permanent one - and its dependent row - was removed.

async function main() {
    const testUserA = randomUUID();
    const testUserB = randomUUID();

    await db.insert(user).values([
        { id: testUserA, name: "Sweep Test A", email: `sweep-a-${testUserA}@example.invalid`, role: "student" },
        { id: testUserB, name: "Sweep Test B", email: `sweep-b-${testUserB}@example.invalid`, role: "admin" },
    ]);

    const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago - already expired

    try {
        const [expiredWorkspace] = await db
            .insert(demoWorkspaces)
            .values({ userId: testUserA, isPermanent: false, expiresAt: pastDate })
            .returning();

        const [permanentWorkspace] = await db
            .insert(demoWorkspaces)
            .values({ userId: testUserB, isPermanent: true, expiresAt: pastDate })
            .returning();

        await db.insert(departments).values({
            workspaceId: expiredWorkspace!.id,
            code: "SWEEP-TEST",
            name: "Sweep Test Department",
        });

        const removedCount = await sweepExpiredWorkspaces();
        console.log(`Sweep removed ${removedCount} workspace(s)`);

        const [expiredStillThere] = await db
            .select()
            .from(demoWorkspaces)
            .where(eq(demoWorkspaces.id, expiredWorkspace!.id));
        const [permanentStillThere] = await db
            .select()
            .from(demoWorkspaces)
            .where(eq(demoWorkspaces.id, permanentWorkspace!.id));
        const [deptStillThere] = await db
            .select()
            .from(departments)
            .where(eq(departments.workspaceId, expiredWorkspace!.id));

        console.log("expired workspace still exists:", Boolean(expiredStillThere));
        console.log("permanent workspace still exists:", Boolean(permanentStillThere));
        console.log("expired workspace's department still exists:", Boolean(deptStillThere));

        if (expiredStillThere || deptStillThere) {
            throw new Error("FAIL: expired workspace (or its cascaded data) survived the sweep");
        }
        if (!permanentStillThere) {
            throw new Error("FAIL: permanent workspace was incorrectly swept");
        }

        console.log("PASS");
    } finally {
        await db.delete(user).where(eq(user.id, testUserA));
        await db.delete(user).where(eq(user.id, testUserB));
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
