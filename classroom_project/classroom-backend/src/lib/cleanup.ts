import { and, eq, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { demoWorkspaces, departments, subjects, classes, enrollments } from "../db/schema/index.js";

// Backstop for workspaces nobody ever revisits after they expire - lazy expiry
// on the request path (see lib/workspace.ts) handles the common case, but only
// runs when that user makes another request. Invoked by src/cron-sweep.ts,
// which Railway's Cron Job scheduler runs on its own process/schedule, not by
// the always-on web server. Returns the number of workspaces removed; throws
// on failure so the caller's exit code reflects it.
export const sweepExpiredWorkspaces = async (): Promise<number> => {
    const deleted = await db
        .delete(demoWorkspaces)
        .where(and(eq(demoWorkspaces.isPermanent, false), lt(demoWorkspaces.expiresAt, new Date())))
        .returning({ id: demoWorkspaces.id });

    return deleted.length;
};

// Deletes every visitor-added ('user'-origin) row from a workspace's
// visitor-writable tables, leaving its seeded ('seed'-origin) fixture data
// untouched. Statement order follows the FK graph (enrollments -> classes ->
// subjects -> departments; departments -> subjects is ON DELETE RESTRICT, not
// cascade) so a 'user' department with a 'user' subject still referencing it
// never trips a constraint mid-flush. Used on explicit sign-out and by the
// permanent-workspace sweep below - non-permanent workspaces don't need this,
// since sweepExpiredWorkspaces already removes them (seed rows included) once
// they expire.
export const flushVisitorRows = async (
    workspaceId: string
): Promise<{ enrollments: number; classes: number; subjects: number; departments: number }> => {
    const deletedEnrollments = await db
        .delete(enrollments)
        .where(and(eq(enrollments.workspaceId, workspaceId), eq(enrollments.origin, "user")))
        .returning({ id: enrollments.id });
    const deletedClasses = await db
        .delete(classes)
        .where(and(eq(classes.workspaceId, workspaceId), eq(classes.origin, "user")))
        .returning({ id: classes.id });
    const deletedSubjects = await db
        .delete(subjects)
        .where(and(eq(subjects.workspaceId, workspaceId), eq(subjects.origin, "user")))
        .returning({ id: subjects.id });
    const deletedDepartments = await db
        .delete(departments)
        .where(and(eq(departments.workspaceId, workspaceId), eq(departments.origin, "user")))
        .returning({ id: departments.id });

    return {
        enrollments: deletedEnrollments.length,
        classes: deletedClasses.length,
        subjects: deletedSubjects.length,
        departments: deletedDepartments.length,
    };
};

// The only workspaces that never go through sweepExpiredWorkspaces's full
// delete-and-reprovision (isPermanent excludes them from both the lazy expiry
// check and the query above) - so an origin-based partial flush is the only
// thing standing between them and unbounded visitor-row growth. In practice
// this is just the site owner's own demo workspace.
export const flushVisitorRowsFromPermanentWorkspaces = async (): Promise<number> => {
    const permanent = await db
        .select({ id: demoWorkspaces.id })
        .from(demoWorkspaces)
        .where(eq(demoWorkspaces.isPermanent, true));

    let total = 0;
    for (const workspace of permanent) {
        const result = await flushVisitorRows(workspace.id);
        total += result.enrollments + result.classes + result.subjects + result.departments;
    }
    return total;
};
