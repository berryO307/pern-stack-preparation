import express from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { demoWorkspaces } from "../db/schema/index.js";
import { requireAuth } from "../middleware/authorize.js";
import { resolveWorkspace, hasValidWorkspace, checkWorkspaceInvariants, isWorkspaceHealthy } from "../lib/workspace.js";
import { flushVisitorRows } from "../lib/cleanup.js";
import { checkProvisionRateLimit, applyProvisionRateLimit } from "../middleware/workspaceProvisionRateLimit.js";
import workspaceMiddleware from "../middleware/workspace.js";

const router = express.Router();

// Idempotent: returns the caller's existing workspace if it's still valid,
// otherwise provisions (and seeds) a fresh one. Safe to call on every login,
// on every tab, any number of times - the frontend uses this right after
// sign-in to get expiresAt up front rather than waiting on the first
// workspace-scoped data request to trigger it lazily.
//
// The rate limit only applies when this call is actually about to provision
// (hasValidWorkspace is false) - a plain "give me my existing workspace"
// call never spends budget, so a legitimate user can't be locked out of
// their own already-provisioned workspace by a handful of calls.
router.post("/workspace", requireAuth, async (req, res) => {
    try {
        const userId = req.user!.id;

        if (!(await hasValidWorkspace(userId))) {
            const rateLimitResult = await checkProvisionRateLimit(req, userId);
            if (!applyProvisionRateLimit(res, rateLimitResult)) return;
        }

        const workspace = await resolveWorkspace(userId, req.user!.role === "admin");

        res.status(200).json({
            data: {
                id: workspace.id,
                expiresAt: workspace.expiresAt,
                isPermanent: workspace.isPermanent,
                wasJustProvisioned: workspace.wasJustProvisioned,
            },
        });
    } catch (e) {
        console.error("POST /demo/workspace error", e);
        res.status(500).json({ error: "Failed to provision workspace" });
    }
});

// Best-effort flush called by the frontend right before it invokes Better
// Auth's own sign-out - a signed-out visitor is never coming back to this
// workspace's session, so their added rows don't need to wait for lazy
// expiry (or, for the admin's permanent workspace, the daily sweep) to go
// away. Looks up the workspace directly rather than through
// resolveWorkspace, which would provision a brand new one if this user
// somehow doesn't have one - pointless work on a path that's about to end
// the session anyway. A missing or already-expired workspace is a no-op,
// not an error - not being able to explicitly flush is fine, since the
// lazy-expiry/sweep backstops still apply.
router.post("/workspace/flush-visitor-data", requireAuth, async (req, res) => {
    try {
        const [workspace] = await db.select().from(demoWorkspaces).where(eq(demoWorkspaces.userId, req.user!.id));

        if (!workspace || (!workspace.isPermanent && workspace.expiresAt <= new Date())) {
            return res.status(200).json({ data: { flushed: 0 } });
        }

        const result = await flushVisitorRows(workspace.id);
        const flushed = result.enrollments + result.classes + result.subjects + result.departments;

        res.status(200).json({ data: { flushed } });
    } catch (e) {
        console.error("POST /demo/workspace/flush-visitor-data error", e);
        res.status(500).json({ error: "Failed to flush workspace data" });
    }
});

// D2: per-invariant pass/fail for the caller's OWN workspace only -
// workspaceMiddleware resolves req.workspaceId the same way every other
// route does (and, as a side effect, transparently re-provisions it first
// if it's incomplete or expired - D3's self-healing). Two people comparing
// screenshots isn't a diagnostic procedure; this turns "my numbers look
// different from yours" into one request either of them can run.
router.get("/workspace/health", requireAuth, workspaceMiddleware, async (req, res) => {
    try {
        const checks = await checkWorkspaceInvariants(req.workspaceId!);
        res.status(200).json({
            data: {
                workspaceId: req.workspaceId,
                healthy: isWorkspaceHealthy(checks),
                checks,
            },
        });
    } catch (e) {
        console.error("GET /demo/workspace/health error", e);
        res.status(500).json({ error: "Failed to check workspace health" });
    }
});

export default router;
