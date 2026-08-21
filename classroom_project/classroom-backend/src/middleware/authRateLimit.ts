import type { Request, Response, NextFunction } from "express";
import type { ArcjetNodeRequest } from "@arcjet/node";
import { fixedWindow } from "@arcjet/node";
import aj from "../config/arcjet.js";

// Tighter than the generic per-role window in security.ts, specifically for
// /api/auth/* - OAuth sign-in/callback/session-check churn from a single IP
// is a much narrower legitimate pattern than general app usage, so it can
// afford a much lower ceiling. Keyed on IP (not userId): most of these
// requests happen before a session exists. Stacks with security.ts's
// global rules (shield/detectBot/sliding window) rather than replacing them.
const authClient = aj.withRule(
    fixedWindow({
        mode: "LIVE",
        window: "1m",
        max: 10,
    })
);

const authRateLimit = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const arcjetRequest: ArcjetNodeRequest = {
            headers: req.headers,
            method: req.method,
            url: req.originalUrl ?? req.url,
            socket: { remoteAddress: req.socket.remoteAddress ?? req.ip ?? "0.0.0.0" },
        };

        const decision = await authClient.protect(arcjetRequest);

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
                message: "Too many sign-in attempts - please wait a moment.",
            });
        }

        next();
    } catch (e) {
        console.error("Auth rate limit middleware error", e);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export default authRateLimit;
