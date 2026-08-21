import { and, eq, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { demoWorkspaces } from "../db/schema/index.js";

// Interim in-process backstop for workspaces nobody ever revisits after they
// expire (lazy expiry on the request path handles the common case, but only
// runs when that user makes another request). Formalizing this as a real
// Railway cron job, separate from the app process, is a later step - not
// this one.
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

export const sweepExpiredWorkspaces = async () => {
    try {
        const deleted = await db
            .delete(demoWorkspaces)
            .where(and(eq(demoWorkspaces.isPermanent, false), lt(demoWorkspaces.expiresAt, new Date())))
            .returning({ id: demoWorkspaces.id });

        if (deleted.length > 0) {
            console.log(`Workspace cleanup: removed ${deleted.length} expired workspace(s)`);
        }
    } catch (e) {
        console.error("Workspace cleanup sweep failed", e);
    }
};

export const startWorkspaceCleanupSchedule = () => {
    sweepExpiredWorkspaces();
    setInterval(sweepExpiredWorkspaces, SWEEP_INTERVAL_MS);
};
