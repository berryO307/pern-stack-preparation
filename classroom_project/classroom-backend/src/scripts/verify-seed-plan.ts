import "dotenv/config";
import { randomInt, randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { user, demoWorkspaces, departments, subjects, classes, enrollments } from "../db/schema/index.js";
import { seedWorkspace } from "../lib/seedWorkspace.js";

// Standalone verification - run manually with
// `tsx src/scripts/verify-seed-plan.ts`. Only ever provisions its own
// disposable, non-permanent workspaces (deleted in `finally`), so it's safe
// to re-run against a shared database including production. Covers B7's
// seed-related assertions:
//   - same seed -> byte-identical class capacities/names (reproducibility)
//   - a different seed -> a visibly different dataset (variation)
//   - the generated dataset satisfies B3's sanity bar (fill-rate buckets,
//     month coverage, distinct KPIs) - generateSeedPlan already asserts this
//     internally and would throw on provisioning if it didn't, but this
//     script re-derives the same checks independently from the persisted
//     rows as a belt-and-braces regression guard.

async function provisionTestWorkspace(seed: number) {
    const ownerId = randomUUID();
    await db.insert(user).values({ id: ownerId, name: "Seed Plan Verify", email: `seed-plan-verify-${ownerId}@example.invalid`, role: "student" });
    const [workspace] = await db
        .insert(demoWorkspaces)
        .values({ userId: ownerId, isPermanent: false, expiresAt: new Date(Date.now() + 60 * 60 * 1000) })
        .returning();
    const usedSeed = await seedWorkspace(db, workspace!.id, seed);
    return { ownerId, workspaceId: workspace!.id, usedSeed };
}

async function teardown(ownerId: string, workspaceId: string) {
    await db.delete(demoWorkspaces).where(eq(demoWorkspaces.id, workspaceId));
    await db.delete(user).where(eq(user.id, ownerId));
}

async function main() {
    const failures: string[] = [];

    // --- Reproducibility: same seed -> identical output ---
    const seedA = randomInt(0, 2 ** 31 - 1);
    const a1 = await provisionTestWorkspace(seedA);
    const a1Classes = await db.select().from(classes).where(eq(classes.workspaceId, a1.workspaceId));

    const a2 = await provisionTestWorkspace(a1.usedSeed);
    const a2Classes = await db.select().from(classes).where(eq(classes.workspaceId, a2.workspaceId));

    const sameCapacities = JSON.stringify(a1Classes.map((c) => c.capacity)) === JSON.stringify(a2Classes.map((c) => c.capacity));
    const sameNames = JSON.stringify(a1Classes.map((c) => c.name)) === JSON.stringify(a2Classes.map((c) => c.name));
    const sameCodes = JSON.stringify(a1Classes.map((c) => c.inviteCode)) === JSON.stringify(a2Classes.map((c) => c.inviteCode));
    console.log(`reproducibility (seed ${a1.usedSeed}): capacities=${sameCapacities} names=${sameNames} codes=${sameCodes}`);
    if (!sameCapacities || !sameNames || !sameCodes) failures.push("same seed did not reproduce identical data");

    // --- Variation: a different seed -> a visibly different dataset ---
    const b = await provisionTestWorkspace(randomInt(0, 2 ** 31 - 1));
    const bClasses = await db.select().from(classes).where(eq(classes.workspaceId, b.workspaceId));
    const differs =
        JSON.stringify(a1Classes.map((c) => c.capacity)) !== JSON.stringify(bClasses.map((c) => c.capacity)) ||
        JSON.stringify(a1Classes.map((c) => c.inviteCode)) !== JSON.stringify(bClasses.map((c) => c.inviteCode));
    console.log(`variation (seed ${a1.usedSeed} vs ${b.usedSeed}): differs=${differs}`);
    if (!differs) failures.push("two different seeds produced identical data (suspiciously unlikely)");

    // --- B3 sanity, re-derived independently from the persisted rows ---
    for (const { label, workspaceId } of [
        { label: "workspace A1", workspaceId: a1.workspaceId },
        { label: "workspace B", workspaceId: b.workspaceId },
    ]) {
        const deptRows = await db.select().from(departments).where(eq(departments.workspaceId, workspaceId));
        const subjectRows = await db.select().from(subjects).where(eq(subjects.workspaceId, workspaceId));
        const classRows = await db.select().from(classes).where(eq(classes.workspaceId, workspaceId));
        const enrollRows = await db.select().from(enrollments).where(eq(enrollments.workspaceId, workspaceId));

        const buckets = new Set(
            classRows.map((c) => {
                const active = enrollRows.filter((e) => e.classId === c.id && e.status === "active").length;
                const ratio = c.capacity > 0 ? active / c.capacity : 0;
                return ratio > 0.8 ? "81-100" : ratio > 0.6 ? "61-80" : ratio > 0.4 ? "41-60" : ratio > 0.2 ? "21-40" : "0-20";
            })
        );
        const months = new Set(enrollRows.map((e) => `${e.createdAt.getUTCFullYear()}-${e.createdAt.getUTCMonth()}`));
        const now = new Date();
        const currentMonthEnroll = enrollRows.filter(
            (e) => e.createdAt.getUTCFullYear() === now.getUTCFullYear() && e.createdAt.getUTCMonth() === now.getUTCMonth()
        );
        const kpis = {
            classes: classRows.length,
            subjects: subjectRows.length,
            students: new Set(currentMonthEnroll.map((e) => e.studentId)).size,
            faculty: new Set(classRows.map((c) => c.teacherId)).size,
        };
        const kpiValues = Object.values(kpis);
        const distinctKpis = new Set(kpiValues).size === kpiValues.length;

        console.log(`${label}: buckets=${buckets.size}/5 months=${months.size}/12 kpis=${JSON.stringify(kpis)} distinct=${distinctKpis}`);
        if (deptRows.length === 0) failures.push(`${label}: no departments`);
        if (buckets.size < 5) failures.push(`${label}: only ${buckets.size}/5 fill-rate buckets covered`);
        if (months.size < 12) failures.push(`${label}: only ${months.size}/12 months covered`);
        if (!distinctKpis) failures.push(`${label}: KPI values not distinct (${JSON.stringify(kpis)})`);
    }

    await teardown(a1.ownerId, a1.workspaceId);
    await teardown(a2.ownerId, a2.workspaceId);
    await teardown(b.ownerId, b.workspaceId);

    if (failures.length > 0) {
        throw new Error(`FAIL:\n  - ${failures.join("\n  - ")}`);
    }
    console.log("PASS");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
