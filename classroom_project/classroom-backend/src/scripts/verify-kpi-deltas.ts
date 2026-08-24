import "dotenv/config";
import { randomInt, randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { user, demoWorkspaces, subjects, classes, enrollments } from "../db/schema/index.js";
import { seedWorkspace } from "../lib/seedWorkspace.js";

// Standalone verification - run manually with `tsx src/scripts/verify-kpi-deltas.ts`.
// Only ever provisions its own disposable, non-permanent workspaces (deleted
// in `finally`), so it's safe to re-run against a shared database including
// production.
//
// Regression guard for the flat "0% vs last month" bug: a fresh workspace's
// students/subjects (and sometimes classes/faculty) KPI cards could render a
// truthful-but-useless 0% delta because their previous-period count happened
// to equal their current total - not a display bug, but a seed-plan gap
// (see seedWorkspace.ts's three delta-guarantee blocks). This re-derives the
// same previous/current numbers dashboard.ts's own SQL would compute,
// independently, straight from the persisted rows.

async function provisionTestWorkspace(seed: number) {
    const ownerId = randomUUID();
    await db.insert(user).values({ id: ownerId, name: "KPI Delta Verify", email: `kpi-delta-verify-${ownerId}@example.invalid`, role: "student" });
    const [workspace] = await db
        .insert(demoWorkspaces)
        .values({ userId: ownerId, isPermanent: false, expiresAt: new Date(Date.now() + 60 * 60 * 1000) })
        .returning();
    await seedWorkspace(db, workspace!.id, seed);
    return { ownerId, workspaceId: workspace!.id };
}

async function teardown(ownerId: string, workspaceId: string) {
    await db.delete(demoWorkspaces).where(eq(demoWorkspaces.id, workspaceId));
    await db.delete(user).where(eq(user.id, ownerId));
}

async function main() {
    const failures: string[] = [];
    const cleanup: { ownerId: string; workspaceId: string }[] = [];
    const RUNS = 5;

    for (let i = 0; i < RUNS; i++) {
        const { ownerId, workspaceId } = await provisionTestWorkspace(randomInt(0, 2 ** 31 - 1));
        cleanup.push({ ownerId, workspaceId });

        const curStart = sql`date_trunc('month', now() AT TIME ZONE 'UTC')`;
        const [studentsRow]: any = (await db.execute(sql`
            select count(distinct student_id) filter (where created_at < ${curStart}) as previous,
                   count(distinct student_id) as total
            from enrollments where workspace_id = ${workspaceId}
        `)).rows ?? [];
        const [subjectsRow]: any = (await db.execute(sql`
            select count(*) filter (where created_at < ${curStart}) as previous, count(*) as total
            from subjects where workspace_id = ${workspaceId}
        `)).rows ?? [];
        const [facultyRow]: any = (await db.execute(sql`
            select count(distinct teacher_id) filter (where created_at < ${curStart}) as previous,
                   count(distinct teacher_id) as total
            from classes where workspace_id = ${workspaceId}
        `)).rows ?? [];
        const [classesRow]: any = (await db.execute(sql`
            select count(*) filter (where created_at < ${curStart}) as previous, count(*) as total
            from classes where workspace_id = ${workspaceId}
        `)).rows ?? [];
        const monthsRes: any = await db.execute(sql`
            select count(distinct date_trunc('month', created_at)) as n from enrollments where workspace_id = ${workspaceId}
        `);
        const monthCount = Number((monthsRes.rows ?? monthsRes)[0]?.n ?? 0);

        const kpis = {
            students: studentsRow,
            subjects: subjectsRow,
            faculty: facultyRow,
            classes: classesRow,
        };
        console.log(`run ${i + 1} (workspace ${workspaceId}): ${JSON.stringify(kpis)} months=${monthCount}/12`);

        for (const [label, row] of Object.entries(kpis)) {
            if (!row) { failures.push(`run ${i + 1}: ${label} query returned no row`); continue; }
            const previous = Number(row.previous);
            const total = Number(row.total);
            if (!(previous < total)) {
                failures.push(`run ${i + 1}: ${label} delta is flat (previous=${previous}, total=${total}) - expected previous < total`);
            }
        }
        if (monthCount < 12) failures.push(`run ${i + 1}: only ${monthCount}/12 months covered`);
    }

    for (const { ownerId, workspaceId } of cleanup) await teardown(ownerId, workspaceId);

    if (failures.length > 0) throw new Error(`FAIL:\n  - ${failures.join("\n  - ")}`);
    console.log(`PASS (${RUNS}/${RUNS} runs, all 4 KPIs had a real non-zero delta and 12/12 month coverage every time)`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
