import type { Request, Response, NextFunction } from "express";
import type { ArcjetNodeRequest } from "@arcjet/node";
import { tokenBucket } from "@arcjet/node";
import aj, { ARCJET_MODE } from "../config/arcjet.js";

// Throttles the RATE of writes to departments/subjects/classes/enrollments,
// independent of the row-quota backstop in rowQuota.ts (which bounds total
// count) - keyed per-user so one visitor's workspace can't be hammered by a
// scripted insert/update/delete loop, even while comfortably under quota.
const writeClient = aj.withRule(
    tokenBucket({
        mode: ARCJET_MODE,
        characteristics: ["userId"],
        capacity: 20,
        refillRate: 20,
        interval: 60,
    })
);

const domainWriteRateLimit = async (req: Request, res: Response, next: NextFunction) => {
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

        const decision = await writeClient.protect(arcjetRequest, { userId, requested: 1 });

        if (decision.isDenied() && decision.reason.isBot()) {
            return res.status(403).json({ error: "Forbidden.", message: "Automated requests are not allowed." });
        }

        if (decision.isDenied() && decision.reason.isShield()) {
            return res.status(403).json({ error: "Forbidden.", message: "Request blocked by security policy." });
        }

        if (decision.isDenied() && decision.reason.isRateLimit()) {
            res.setHeader("Retry-After", "60");
            return res.status(429).json({
                error: "Too many requests.",
                message: "Too many changes too quickly - please slow down.",
            });
        }

        next();
    } catch (e) {
        console.error("Domain write rate limit error", e);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export default domainWriteRateLimit;
