import type { Request, Response, NextFunction } from "express";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { enrollments } from "../db/schema/index.js";

// Backstop against a single workspace accumulating unbounded rows within its
// lifetime - the 1-hour expiry bounds this too, but a busy/abused workspace
// could still spam-create within that hour. Checked on create only; edits and
// deletes are unaffected. Must run after workspaceMiddleware.
export const ROW_QUOTA_PER_TABLE = 500;

export const enforceRowQuota = (table: PgTable, workspaceIdColumn: AnyPgColumn, label: string) =>
    async (req: Request, res: Response, next: NextFunction) => {
        if (!req.workspaceId) return res.status(401).json({ error: "Sign in required" });

        try {
            const [row] = await db
                .select({ count: sql<number>`count(*)` })
                .from(table)
                .where(eq(workspaceIdColumn, req.workspaceId));

            if ((row?.count ?? 0) >= ROW_QUOTA_PER_TABLE) {
                return res.status(429).json({
                    error: `This workspace has reached its ${label} limit (${ROW_QUOTA_PER_TABLE}). Delete some before adding more.`,
                });
            }

            next();
        } catch (e) {
            console.error(`Row quota check error (${label})`, e);
            res.status(500).json({ error: "Failed to check workspace quota" });
        }
    };

// Narrower than ROW_QUOTA_PER_TABLE above: that one bounds enrollments
// (seed + visitor combined) at 500 as a general anti-spam backstop; this one
// specifically bounds how many self-enrollments a single workspace's visitor
// can rack up, well before that backstop would ever trigger, and is what a
// real visitor is actually likely to hit. 409 (not 429) since this isn't a
// rate/time thing - it won't clear until the workspace flushes or resets.
export const VISITOR_ENROLLMENT_QUOTA = 25;

export const enforceVisitorEnrollmentQuota = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.workspaceId) return res.status(401).json({ error: "Sign in required" });

    try {
        const [row] = await db
            .select({ count: sql<number>`count(*)` })
            .from(enrollments)
            .where(and(eq(enrollments.workspaceId, req.workspaceId), eq(enrollments.origin, "user")));

        if ((row?.count ?? 0) >= VISITOR_ENROLLMENT_QUOTA) {
            return res.status(409).json({
                error: `This workspace has reached its self-enrollment limit (${VISITOR_ENROLLMENT_QUOTA}). Sign out and back in, or wait for your workspace to reset, before enrolling in more classes.`,
            });
        }

        next();
    } catch (e) {
        console.error("Visitor enrollment quota check error", e);
        res.status(500).json({ error: "Failed to check enrollment quota" });
    }
};
