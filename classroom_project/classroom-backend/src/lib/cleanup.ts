import { and, eq, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { user } from "../db/schema/index.js";

export const GUEST_SESSION_HOURS = 2;
const SWEEP_INTERVAL_MS = 30 * 60 * 1000;

// Guest accounts (and everything they created - cascades via createdBy FKs) are purged
// once they're older than GUEST_SESSION_HOURS. There's no reliable "browser tab closed"
// signal, so this age-based sweep is the real cleanup mechanism.
export const sweepExpiredGuests = async () => {
    const cutoff = new Date(Date.now() - GUEST_SESSION_HOURS * 60 * 60 * 1000);

    try {
        const deleted = await db
            .delete(user)
            .where(and(eq(user.isAnonymous, true), lt(user.createdAt, cutoff)))
            .returning({ id: user.id });

        if (deleted.length > 0) {
            console.log(`Guest cleanup: removed ${deleted.length} expired guest account(s)`);
        }
    } catch (e) {
        console.error("Guest cleanup sweep failed", e);
    }
};

export const startGuestCleanupSchedule = () => {
    sweepExpiredGuests();
    setInterval(sweepExpiredGuests, SWEEP_INTERVAL_MS);
};
