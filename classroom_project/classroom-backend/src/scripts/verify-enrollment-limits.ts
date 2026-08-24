import "dotenv/config";
import { randomInt, randomUUID } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import { user, demoWorkspaces, classes, enrollments } from "../db/schema/index.js";
import { seedWorkspace } from "../lib/seedWorkspace.js";
import { enforceVisitorEnrollmentQuota, VISITOR_ENROLLMENT_QUOTA } from "../middleware/rowQuota.js";

// Standalone verification - run manually with
// `tsx src/scripts/verify-enrollment-limits.ts`. Only touches its own
// disposable, non-permanent workspace (deleted in `finally`), safe to re-run
// against a shared database.
//
// Covers B7:
//   - B6: enforceVisitorEnrollmentQuota (the real middleware, invoked
//     directly rather than reimplemented) rejects with 409 once a workspace
//     has VISITOR_ENROLLMENT_QUOTA 'user'-origin enrollments
//   - the enrollments_student_id_class_id_unique index rejects a concurrent
//     double submit for the same student+class, mirroring routes/
//     enrollments.ts's own db.batch capacity-check-and-insert pattern

function fakeReqRes(workspaceId: string) {
    const req = { workspaceId, user: { id: "test" } } as unknown as Request;
    let statusCode = 200;
    let body: unknown;
    const res = {
        status(code: number) {
            statusCode = code;
            return this;
        },
        json(payload: unknown) {
            body = payload;
            return this;
        },
    } as unknown as Response;
    let nextCalled = false;
    const next = () => {
        nextCalled = true;
    };
    return { req, res, next, getResult: () => ({ statusCode, body, nextCalled }) };
}

async function main() {
    const failures: string[] = [];
    const ownerId = randomUUID();
    let workspaceId: string | undefined;

    try {
        await db.insert(user).values({ id: ownerId, name: "Enrollment Limits Verify", email: `enrollment-limits-verify-${ownerId}@example.invalid`, role: "student" });
        const [workspace] = await db
            .insert(demoWorkspaces)
            .values({ userId: ownerId, isPermanent: false, expiresAt: new Date(Date.now() + 60 * 60 * 1000) })
            .returning();
        workspaceId = workspace!.id;
        await seedWorkspace(db, workspaceId, randomInt(0, 2 ** 31 - 1));

        const classRows = await db.select().from(classes).where(eq(classes.workspaceId, workspaceId));
        const activeCountByClass = new Map<number, number>();
        for (const c of classRows) {
            const [row] = await db
                .select({ count: sql<number>`count(*)` })
                .from(enrollments)
                .where(and(eq(enrollments.classId, c.id), eq(enrollments.status, "active")));
            activeCountByClass.set(c.id, Number(row?.count ?? 0));
        }

        // Two DIFFERENT classes, on purpose: the quota-fill loop below adds
        // VISITOR_ENROLLMENT_QUOTA rows to one of them, which would eat into
        // whatever capacity headroom the race test needs on that same class.
        // The quota middleware itself is workspace-scoped (not per-class), so
        // which class the fill rows land on doesn't matter for that half of
        // the test - only the race test cares about headroom.
        const byMostHeadroom = [...classRows].sort((a, b) => b.capacity - activeCountByClass.get(b.id)! - (a.capacity - activeCountByClass.get(a.id)!));
        const quotaFillClass = byMostHeadroom[0]!;
        const raceClass = byMostHeadroom[1]!;
        const raceHeadroom = raceClass.capacity - activeCountByClass.get(raceClass.id)!;
        if (raceHeadroom < 1) throw new Error(`race-test class has no capacity headroom (capacity=${raceClass.capacity}, active=${activeCountByClass.get(raceClass.id)})`);

        const alreadyEnrolledInFillClass = new Set(
            (await db.select({ studentId: enrollments.studentId }).from(enrollments).where(eq(enrollments.classId, quotaFillClass.id))).map((r) => r.studentId)
        );
        const alreadyEnrolledInRaceClass = new Set(
            (await db.select({ studentId: enrollments.studentId }).from(enrollments).where(eq(enrollments.classId, raceClass.id))).map((r) => r.studentId)
        );
        const allStudents = await db.select({ id: user.id }).from(user).where(eq(user.role, "student"));
        const fillStudents = allStudents.filter((s) => !alreadyEnrolledInFillClass.has(s.id)).slice(0, VISITOR_ENROLLMENT_QUOTA);
        const raceStudentCandidate = allStudents.find((s) => !alreadyEnrolledInRaceClass.has(s.id));
        if (fillStudents.length < VISITOR_ENROLLMENT_QUOTA || !raceStudentCandidate) {
            throw new Error(`too few unenrolled fixture students for this test (fill=${fillStudents.length}, race=${!!raceStudentCandidate})`);
        }

        // --- B6: under quota should call next(), not respond ---
        {
            const { req, res, next, getResult } = fakeReqRes(workspaceId);
            await enforceVisitorEnrollmentQuota(req, res, next);
            const result = getResult();
            console.log(`under quota (0 visitor enrollments): nextCalled=${result.nextCalled}`);
            if (!result.nextCalled) failures.push("under quota: middleware did not call next()");
        }

        // Insert VISITOR_ENROLLMENT_QUOTA 'user'-origin enrollments (distinct
        // students, all on quotaFillClass - fine, the unique index is per
        // student+class, and the quota itself is workspace-scoped).
        for (let i = 0; i < VISITOR_ENROLLMENT_QUOTA; i++) {
            await db.insert(enrollments).values({
                workspaceId,
                classId: quotaFillClass.id,
                studentId: fillStudents[i]!.id,
                origin: "user",
            });
        }

        // --- B6: at quota should respond 409, not call next() ---
        {
            const { req, res, next, getResult } = fakeReqRes(workspaceId);
            await enforceVisitorEnrollmentQuota(req, res, next);
            const result = getResult();
            console.log(`at quota (${VISITOR_ENROLLMENT_QUOTA} visitor enrollments): statusCode=${result.statusCode} nextCalled=${result.nextCalled}`, result.body);
            if (result.nextCalled) failures.push("at quota: middleware called next() instead of rejecting");
            if (result.statusCode !== 409) failures.push(`at quota: expected 409, got ${result.statusCode}`);
        }

        // --- Duplicate-enrollment race: two concurrent inserts for the same
        // student+class, mirroring routes/enrollments.ts's transaction pattern ---
        const raceStudentId = raceStudentCandidate.id; // not yet enrolled in raceClass
        const attempt = () =>
            db.transaction(async (tx) => {
                await tx.execute(sql`SELECT capacity FROM ${classes} WHERE ${classes.id} = ${raceClass.id} FOR UPDATE`);
                return tx.execute(sql`
                    INSERT INTO ${enrollments} (class_id, student_id, workspace_id)
                    SELECT ${raceClass.id}, ${raceStudentId}, ${workspaceId}
                    WHERE (SELECT count(*) FROM ${enrollments} WHERE class_id = ${raceClass.id} AND status = 'active')
                        < (SELECT capacity FROM ${classes} WHERE id = ${raceClass.id})
                    RETURNING *
                `);
            });

        const [resultA, resultB] = await Promise.allSettled([attempt(), attempt()]);
        const pgErrorCode = (e: any): string | undefined => e?.code ?? e?.cause?.code;
        const outcomes = [resultA, resultB].map((r) => (r.status === "fulfilled" ? "inserted" : pgErrorCode(r.reason) === "23505" ? "duplicate-rejected" : `error:${r.reason}`));
        console.log("concurrent double-submit outcomes:", outcomes);

        const insertedCount = outcomes.filter((o) => o === "inserted").length;
        const rejectedCount = outcomes.filter((o) => o === "duplicate-rejected").length;
        if (insertedCount !== 1 || rejectedCount !== 1) {
            failures.push(`expected exactly 1 insert + 1 duplicate-rejection, got ${JSON.stringify(outcomes)}`);
        }

        const finalRows = await db
            .select()
            .from(enrollments)
            .where(and(eq(enrollments.classId, raceClass.id), eq(enrollments.studentId, raceStudentId)));
        console.log(`rows for the raced student+class pair after both attempts: ${finalRows.length} (expected 1)`);
        if (finalRows.length !== 1) failures.push(`unique index did not prevent a duplicate row (found ${finalRows.length})`);

        if (failures.length > 0) throw new Error(`FAIL:\n  - ${failures.join("\n  - ")}`);
        console.log("PASS");
    } finally {
        if (workspaceId) await db.delete(demoWorkspaces).where(eq(demoWorkspaces.id, workspaceId));
        await db.delete(user).where(eq(user.id, ownerId));
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
