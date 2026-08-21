import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { demoWorkspaces } from "../db/schema/index.js";
import { seedWorkspace } from "./seedWorkspace.js";
import type { DemoWorkspace } from "../db/schema/index.js";

export const WORKSPACE_LIFETIME_MS = 60 * 60 * 1000;

const pgErrorCode = (e: any): string | undefined => e?.code ?? e?.cause?.code;

// Returns the caller's current workspace, provisioning (and seeding) a fresh one
// if none exists yet or the previous one has expired. Expired workspaces are
// deleted outright - cascading to every domain table via workspace_id foreign
// keys - rather than flagged, so there's never more than one row per user and
// no separate "is this the active one" query is needed anywhere else.
export const resolveWorkspace = async (userId: string, isAdmin: boolean): Promise<DemoWorkspace> => {
    const [existing] = await db.select().from(demoWorkspaces).where(eq(demoWorkspaces.userId, userId));

    if (existing) {
        if (existing.isPermanent || existing.expiresAt > new Date()) {
            return existing;
        }
        await db.delete(demoWorkspaces).where(eq(demoWorkspaces.id, existing.id));
    }

    return provisionWorkspace(userId, isAdmin);
};

const provisionWorkspace = async (userId: string, isAdmin: boolean): Promise<DemoWorkspace> => {
    // Admin's workspace is flagged permanent and given a far-future expiresAt
    // for display purposes only - isPermanent is what actually exempts it from
    // both the lazy expiry check above and the sweep job, not this value.
    const expiresAt = isAdmin
        ? new Date("2099-12-31T00:00:00.000Z")
        : new Date(Date.now() + WORKSPACE_LIFETIME_MS);

    try {
        const [created] = await db
            .insert(demoWorkspaces)
            .values({ userId, isPermanent: isAdmin, expiresAt })
            .returning();

        if (!created) throw new Error("Workspace insert returned no row");

        await seedWorkspace(created.id);

        const [seeded] = await db
            .update(demoWorkspaces)
            .set({ seededAt: new Date() })
            .where(eq(demoWorkspaces.id, created.id))
            .returning();

        return seeded!;
    } catch (e: any) {
        // Unique violation on user_id: a concurrent request from the same user
        // (e.g. two tabs) already provisioned one - use that instead of erroring.
        if (pgErrorCode(e) === "23505") {
            const [existing] = await db.select().from(demoWorkspaces).where(eq(demoWorkspaces.userId, userId));
            if (existing) return existing;
        }
        throw e;
    }
};
