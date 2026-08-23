import "dotenv/config";
import { randomInt, randomUUID } from "crypto";
import { eq, like, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { user, demoWorkspaces } from "../db/schema/index.js";
import { seedWorkspace } from "../lib/seedWorkspace.js";

// Standalone verification - run manually with
// `tsx src/scripts/verify-fixture-pool-stability.ts`. Regression guard for a
// real bug: the shared teacher/student fixture pool must be identical across
// every workspace (matched by email), not regenerated - a random name pairing
// previously minted a new "unique" email per workspace, permanently leaking
// ~25 garbage user rows on every single provision (fixture users are global
// and never swept, unlike workspace-scoped domain data). Provisions two
// separate workspaces and asserts the fixture pool size is identical after
// each - not growing on the second one.

async function fixtureCount() {
    const [row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(user)
        .where(like(user.email, "%@example.edu"));
    return Number(row?.count ?? 0);
}

async function main() {
    const testUserIds: string[] = [];
    const countsAfterEach: number[] = [];

    for (let i = 0; i < 2; i++) {
        const id = randomUUID();
        await db.insert(user).values({
            id,
            name: `Stability Test ${i}`,
            email: `fixture-stability-test-${id}@example.invalid`,
            role: "student",
        });
        testUserIds.push(id);

        const [workspace] = await db
            .insert(demoWorkspaces)
            .values({ userId: id, isPermanent: false, expiresAt: new Date(Date.now() + 60 * 60 * 1000) })
            .returning();

        await seedWorkspace(workspace!.id, randomInt(0, 2 ** 31 - 1));

        const count = await fixtureCount();
        countsAfterEach.push(count);
        console.log(`fixture pool size after workspace #${i + 1}: ${count}`);
    }

    for (const id of testUserIds) {
        await db.delete(user).where(eq(user.id, id));
    }

    if (countsAfterEach[0] !== countsAfterEach[1]) {
        throw new Error(
            `FAIL: fixture pool grew between workspaces (${countsAfterEach[0]} -> ${countsAfterEach[1]}) - it should be identical`
        );
    }
    console.log("PASS - fixture pool stayed stable across two separate workspace provisions");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
