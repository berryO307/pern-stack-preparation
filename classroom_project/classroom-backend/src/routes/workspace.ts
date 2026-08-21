import express from "express";
import { requireAuth } from "../middleware/authorize.js";
import { resolveWorkspace } from "../lib/workspace.js";
import workspaceProvisionRateLimit from "../middleware/workspaceProvisionRateLimit.js";

const router = express.Router();

// Idempotent: returns the caller's existing workspace if it's still valid,
// otherwise provisions (and seeds) a fresh one. Safe to call on every login -
// the frontend uses this right after sign-in to get expiresAt up front rather
// than waiting on the first workspace-scoped data request to trigger it lazily.
router.post("/workspace", requireAuth, workspaceProvisionRateLimit, async (req, res) => {
    try {
        const workspace = await resolveWorkspace(req.user!.id, req.user!.role === "admin");

        res.status(200).json({
            data: {
                id: workspace.id,
                expiresAt: workspace.expiresAt,
                isPermanent: workspace.isPermanent,
            },
        });
    } catch (e) {
        console.error("POST /demo/workspace error", e);
        res.status(500).json({ error: "Failed to provision workspace" });
    }
});

export default router;
