import "dotenv/config";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { user, demoWorkspaces, departments } from "../db/schema/index.js";
import { enforceRowQuota, ROW_QUOTA_PER_TABLE } from "../middleware/rowQuota.js";

// Standalone verification - run manually with `tsx src/scripts/verify-row-quota.ts`.
// Bulk-inserts departments directly (bypassing HTTP - 500 real requests would
// be slow and isn't what's under test) up to one below the quota, confirms the
// middleware lets a create through, tops it up to exactly the quota, and
// confirms the next create is rejected with 429.

async function callMiddleware(workspaceId: string) {
    const middleware = enforceRowQuota(departments, departments.workspaceId, "department");
    let statusCode: number | undefined;
    let body: unknown;
    let nextCalled = false;

    const req = { workspaceId } as any;
    const res = {
        status(code: number) {
            statusCode = code;
            return this;
        },
        json(payload: unknown) {
            body = payload;
            return this;
        },
    } as any;
    const next = () => {
        nextCalled = true;
    };

    await middleware(req, res, next);
    return { statusCode, body, nextCalled };
}

async function main() {
    const testUserId = randomUUID();
    await db.insert(user).values({
        id: testUserId,
        name: "Quota Test User",
        email: `quota-test-${testUserId}@example.invalid`,
        role: "student",
    });

    try {
        const [workspace] = await db
            .insert(demoWorkspaces)
            .values({ userId: testUserId, isPermanent: false, expiresAt: new Date(Date.now() + 60 * 60 * 1000) })
            .returning();
        const workspaceId = workspace!.id;

        // Fill to one below the quota.
        const belowQuotaRows = Array.from({ length: ROW_QUOTA_PER_TABLE - 1 }, (_, i) => ({
            workspaceId,
            code: `Q-${i}`,
            name: `Quota Test Department ${i}`,
        }));
        await db.insert(departments).values(belowQuotaRows);

        const belowResult = await callMiddleware(workspaceId);
        console.log(`At ${ROW_QUOTA_PER_TABLE - 1} rows: nextCalled=${belowResult.nextCalled}, status=${belowResult.statusCode}`);
        if (!belowResult.nextCalled) {
            throw new Error("FAIL: expected the create to be allowed one below the quota");
        }

        // Top up to exactly the quota.
        await db.insert(departments).values({ workspaceId, code: "Q-LAST", name: "Quota Test Department Last" });

        const atResult = await callMiddleware(workspaceId);
        console.log(`At ${ROW_QUOTA_PER_TABLE} rows: nextCalled=${atResult.nextCalled}, status=${atResult.statusCode}, body=${JSON.stringify(atResult.body)}`);
        if (atResult.nextCalled || atResult.statusCode !== 429) {
            throw new Error("FAIL: expected the create to be rejected with 429 at the quota");
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
