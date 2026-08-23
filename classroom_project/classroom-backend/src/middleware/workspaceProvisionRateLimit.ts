import type { Request, Response, NextFunction } from "express";
import type { ArcjetNodeRequest } from "@arcjet/node";
import { tokenBucket } from "@arcjet/node";
import aj, { ARCJET_MODE } from "../config/arcjet.js";

// POST /api/demo/workspace is normally called once per sign-in; the lazy
// path in middleware/workspace.ts otherwise just reuses an existing
// unexpired workspace, so it's naturally self-limiting. This bounds
// repeated-provisioning abuse of the explicit endpoint while leaving
// generous headroom for legitimate multi-tab/reconnect calls.
const provisionClient = aj.withRule(
    tokenBucket({
        mode: ARCJET_MODE,
        characteristics: ["userId"],
        capacity: 3,
        refillRate: 3,
        interval: "1h",
    })
);

const workspaceProvisionRateLimit = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Sign in required" });

    try {
        const userId = req.user.id;

        const arcjetRequest: ArcjetNodeRequest & { userId: string } = {
            headers: req.headers,
            method: req.method,
            url: req.originalUrl ?? req.url,
            socket: { remoteAddress: req.socket.remoteAddress ?? req.ip ?? "0.0.0.0" },
            userId,
        };

        const decision = await provisionClient.protect(arcjetRequest, { userId, requested: 1 });

        if (decision.isDenied() && decision.reason.isBot()) {
            return res.status(403).json({ error: "Forbidden.", message: "Automated requests are not allowed." });
        }

        if (decision.isDenied() && decision.reason.isShield()) {
            return res.status(403).json({ error: "Forbidden.", message: "Request blocked by security policy." });
        }

        if (decision.isDenied() && decision.reason.isRateLimit()) {
            res.setHeader("Retry-After", "3600");
            return res.status(429).json({
                error: "Too many requests.",
                message: "Too many workspace requests - please wait a bit before trying again.",
            });
        }

        next();
    } catch (e) {
        console.error("Workspace provisioning rate limit error", e);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export default workspaceProvisionRateLimit;
