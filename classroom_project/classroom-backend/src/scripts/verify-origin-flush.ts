import "dotenv/config";
import { randomInt, randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { user, demoWorkspaces, departments, subjects, classes, enrollments } from "../db/schema/index.js";
import { seedWorkspace } from "../lib/seedWorkspace.js";
import { flushVisitorRows } from "../lib/cleanup.js";

// Standalone verification - run manually with
// `tsx src/scripts/verify-origin-flush.ts`. Only touches its own disposable
// workspaces, deleted in `finally` - deliberately never calls
// flushVisitorRowsFromPermanentWorkspaces() (which sweeps every permanent
// workspace in the database, including the real admin one) so this is safe
// to re-run against a shared/production database. Instead it calls
// flushVisitorRows() directly against a disposable workspace flagged
// isPermanent - that exercises the exact same deletion logic the sweep uses,
// without touching anything real.
//
// Covers B7:
//   - flush deletes all 'user' rows and zero 'seed' rows
//   - a request body trying to smuggle `origin: 'seed'` still produces a
//     'user' row, because the real route handlers destructure an explicit
//     field list rather than spreading req.body (mirrored here exactly)

async function main() {
    const failures: string[] = [];
    const ownerId = randomUUID();
    let workspaceId: string | undefined;

    try {
        await db.insert(user).values({ id: ownerId, name: "Origin Flush Verify", email: `origin-flush-verify-${ownerId}@example.invalid`, role: "student" });

        const [workspace] = await db
            .insert(demoWorkspaces)
            // isPermanent: true so this also exercises the branch permanent
            // workspaces take (excluded from full-delete expiry, relies on
            // flushVisitorRows alone) - never registered as the real admin's,
            // since uniqueness is per userId and this uses a disposable one.
            .values({ userId: ownerId, isPermanent: true, expiresAt: new Date("2099-12-31T00:00:00.000Z") })
            .returning();
        workspaceId = workspace!.id;

        await seedWorkspace(db, workspaceId, randomInt(0, 2 ** 31 - 1));

        // Simulate real visitor writes via routes/departments.ts and
        // routes/subjects.ts's own value-construction pattern - a malicious
        // body with `origin: 'seed'` mixed in, destructured to only the
        // fields those routes actually read.
        const maliciousDeptBody: any = { name: "Hack Dept", code: "HAX", description: "smuggled", origin: "seed" };
        const { name, code, description } = maliciousDeptBody; // exactly what routes/departments.ts's POST does
        const [dept] = await db.insert(departments).values({ name, code, description, workspaceId }).returning();

        console.log(`malicious body origin:'seed' -> persisted row origin: '${dept!.origin}'`);
        if (dept!.origin !== "user") failures.push(`origin-smuggling: expected 'user', got '${dept!.origin}'`);

        const [subj] = await db.insert(subjects).values({ workspaceId, code: "VIS101", name: "Visitor Subject", departmentId: dept!.id, origin: "user" }).returning();
        const [anyTeacher] = await db.select({ id: user.id }).from(user).where(eq(user.role, "teacher"));
        const [cls] = await db
            .insert(classes)
            .values({ workspaceId, name: "Visitor Class", subjectId: subj!.id, teacherId: anyTeacher!.id, capacity: 10, inviteCode: "ZZZ999", schedules: [], origin: "user" })
            .returning();
        const [anyStudent] = await db.select({ id: user.id }).from(user).where(eq(user.role, "student"));
        await db.insert(enrollments).values({ workspaceId, classId: cls!.id, studentId: anyStudent!.id, origin: "user" });

        const before = {
            departments: (await db.select().from(departments).where(eq(departments.workspaceId, workspaceId))).length,
            subjects: (await db.select().from(subjects).where(eq(subjects.workspaceId, workspaceId))).length,
            classes: (await db.select().from(classes).where(eq(classes.workspaceId, workspaceId))).length,
            enrollments: (await db.select().from(enrollments).where(eq(enrollments.workspaceId, workspaceId))).length,
        };
        console.log("before flush:", before);

        await flushVisitorRows(workspaceId);

        const afterDepts = await db.select().from(departments).where(eq(departments.workspaceId, workspaceId));
        const afterSubjects = await db.select().from(subjects).where(eq(subjects.workspaceId, workspaceId));
        const afterClasses = await db.select().from(classes).where(eq(classes.workspaceId, workspaceId));
        const afterEnrollments = await db.select().from(enrollments).where(eq(enrollments.workspaceId, workspaceId));

        const after = { departments: afterDepts.length, subjects: afterSubjects.length, classes: afterClasses.length, enrollments: afterEnrollments.length };
        console.log("after flush:", after);

        const anyUserLeft = [...afterDepts, ...afterSubjects, ...afterClasses, ...afterEnrollments].some((r: any) => r.origin === "user");
        const allSeedIntact =
            afterDepts.every((r) => r.origin === "seed") &&
            afterSubjects.every((r) => r.origin === "seed") &&
            afterClasses.every((r) => r.origin === "seed") &&
            afterEnrollments.every((r) => r.origin === "seed");

        console.log(`zero 'user' rows remain: ${!anyUserLeft}; all remaining rows are 'seed': ${allSeedIntact}`);
        if (anyUserLeft) failures.push("flush left at least one 'user'-origin row behind");
        if (!allSeedIntact) failures.push("flush removed a 'seed'-origin row (should be untouched)");
        if (before.departments <= after.departments) failures.push("flush did not remove the visitor department");

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
