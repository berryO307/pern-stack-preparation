import { and, eq, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { demoWorkspaces } from "../db/schema/index.js";

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
