import type { Request, Response, NextFunction } from "express";
import { resolveWorkspace } from "../lib/workspace.js";

// Must run after requireAuth. Resolves req.user's demo workspace - lazily
// provisioning and reseeding it first if it doesn't exist yet or has expired -
// and attaches its id as req.workspaceId for route handlers to scope queries by.
const workspaceMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Sign in required" });

    try {
        const workspace = await resolveWorkspace(req.user.id, req.user.role === "admin");
        req.workspaceId = workspace.id;
        next();
    } catch (e) {
        console.error("Workspace resolution error", e);
        res.status(500).json({ error: "Failed to resolve workspace" });
    }
};

export default workspaceMiddleware;
