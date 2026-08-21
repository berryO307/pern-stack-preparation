import type { Request, Response, NextFunction } from "express";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";

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
