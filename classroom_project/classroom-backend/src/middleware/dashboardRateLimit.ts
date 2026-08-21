import type { Request, Response, NextFunction } from "express";
import type { ArcjetNodeRequest } from "@arcjet/node";
import { tokenBucket } from "@arcjet/node";
import aj from "../config/arcjet.js";

// Known synthetic-monitoring callers that should never be rate limited or
// bot-blocked: Site24x7's RUM/uptime agents and Railway's platform health
// checker. Matched on User-Agent since neither documents a stable header we
// can assert on more precisely from this side.
const MONITORING_USER_AGENT_PATTERNS = [/site24x7/i, /railway/i];

const isMonitoringRequest = (req: Request): boolean => {
    const userAgent = req.headers["user-agent"] ?? "";
    return MONITORING_USER_AGENT_PATTERNS.some((pattern) => pattern.test(userAgent));
};

// Dashboard-summary-specific limit, keyed on the authenticated user (falling
// back to IP for the rare unauthenticated case) rather than the blanket
// per-role limit in security.ts — this query is heavier than a typical list
// endpoint, so it gets its own tighter, per-identity budget: capacity 10
// (max instantaneous burst) refilling 10 tokens every 20s, i.e. 30/min
// sustained with room for a 10-request burst.
const dashboardSummaryClient = aj.withRule(
    tokenBucket({
        mode: "LIVE",
        characteristics: ["userId"],
        capacity: 10,
        refillRate: 10,
        interval: 20,
    })
);

const dashboardRateLimit = async (req: Request, res: Response, next: NextFunction) => {
    if (isMonitoringRequest(req)) return next();

    try {
        const userId = req.user?.id ?? req.ip ?? "anonymous";

        const arcjetRequest: ArcjetNodeRequest & { userId: string } = {
            headers: req.headers,
            method: req.method,
            url: req.originalUrl ?? req.url,
            socket: { remoteAddress: req.socket.remoteAddress ?? req.ip ?? "0.0.0.0" },
            userId,
        };

        const decision = await dashboardSummaryClient.protect(arcjetRequest, { userId, requested: 1 });

        if (decision.isDenied() && decision.reason.isBot()) {
            return res.status(403).json({ error: "Forbidden.", message: "Automated Requests are not allowed." });
        }

        if (decision.isDenied() && decision.reason.isShield()) {
            return res.status(403).json({ error: "Forbidden.", message: "Request blocked by security policy." });
        }

        if (decision.isDenied() && decision.reason.isRateLimit()) {
            res.setHeader("Retry-After", "20");
            return res.status(429).json({
                error: "Too many requests.",
                message: "Dashboard is refreshing too often — please wait a moment.",
            });
        }

        next();
    } catch (e) {
        console.error("Dashboard rate limit middleware error", e);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export default dashboardRateLimit;
