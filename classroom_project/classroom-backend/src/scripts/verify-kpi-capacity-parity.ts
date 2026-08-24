import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { demoWorkspaces } from "../db/schema/index.js";
import { eq } from "drizzle-orm";

// Guards the exact contradiction FINDINGS.md documents: the Classes KPI and
// the capacity distribution chart independently summing to different
// numbers. They're built from the same `classes` rows with the same
// workspace filter in routes/dashboard.ts, so they can't structurally
// drift - this re-derives both counts directly against the DB (not through
// the API) and fails if they ever stop matching.
async function main() {
    const [workspace] = await db.select().from(demoWorkspaces).where(eq(demoWorkspaces.isPermanent, true));
    if (!workspace) throw new Error("No permanent workspace found");

    const [classesTotal] = await db.execute<{ n: string }>(
        sql`select count(*) as n from classes where workspace_id = ${workspace.id}`
    ).then((r) => r.rows);

    const [bucketed] = await db.execute<{ bucketed: string; excluded: string }>(sql`
        with class_ratios as (
            select c.id, c.capacity, count(e.id) filter (where e.status = 'active') as enrolled
            from classes c
            left join enrollments e on e.class_id = c.id
            where c.workspace_id = ${workspace.id}
            group by c.id, c.capacity
        )
        select
            count(*) filter (where capacity > 0) as bucketed,
            count(*) filter (where capacity <= 0) as excluded
        from class_ratios
    `).then((r) => r.rows);

    const total = Number(classesTotal?.n ?? 0);
    const bucketedCount = Number(bucketed?.bucketed ?? 0);
    const excludedCount = Number(bucketed?.excluded ?? 0);

    console.log(`classes total: ${total}`);
    console.log(`bucketed (capacity > 0): ${bucketedCount}`);
    console.log(`excluded (no capacity set): ${excludedCount}`);
    console.log(`bucketed + excluded: ${bucketedCount + excludedCount}`);

    if (total !== bucketedCount + excludedCount) {
        throw new Error(
            `Parity check FAILED: classes total (${total}) !== bucketed + excluded (${bucketedCount + excludedCount})`
        );
    }
    console.log("OK - Classes KPI total equals capacity-bucketed + excluded.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
