import type { Request, Response, NextFunction } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { user } from "../db/schema/index.js";

// Non-admin accounts (guests and any future self-serve accounts) are capped at this
// many total creates across departments/subjects/classes/enrollments/users combined.
export const GUEST_WRITE_QUOTA = 15;

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Sign in required" });
    next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Sign in required" });
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admins only" });
    next();
};

// Blocks the request once a non-admin account has hit its lifetime write quota.
// Admins are unmetered. Must run after requireAuth (or check req.user itself).
export const enforceWriteQuota = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Sign in required" });
    if (req.user.role === "admin") return next();

    try {
        const [row] = await db
            .select({ writeCount: user.writeCount })
            .from(user)
            .where(eq(user.id, req.user.id));

        if ((row?.writeCount ?? 0) >= GUEST_WRITE_QUOTA) {
            return res.status(429).json({
                error: `Guest write limit reached (${GUEST_WRITE_QUOTA} items). Start a new guest session to keep exploring.`,
            });
        }

        next();
    } catch (e) {
        console.error("enforceWriteQuota error", e);
        res.status(500).json({ error: "Failed to check write quota" });
    }
};

export const incrementWriteCount = async (userId: string) => {
    await db.update(user).set({ writeCount: sql`${user.writeCount} + 1` }).where(eq(user.id, userId));
};
