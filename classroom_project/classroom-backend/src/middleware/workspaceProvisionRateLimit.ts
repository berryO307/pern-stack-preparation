import type { Request, Response } from "express";
import type { ArcjetNodeRequest } from "@arcjet/node";
import { tokenBucket } from "@arcjet/node";
import aj, { ARCJET_MODE } from "../config/arcjet.js";

// Idempotency (see lib/workspace.ts) is the actual defence against repeated
// calls now, not this limit - a workspace either fully exists or doesn't,
// so calling POST /workspace any number of times is safe. This only guards
// the genuinely expensive path (an actual seed run, ~950 rows), and the
// route only spends budget here when one is about to happen - see
// routes/workspace.ts, which checks hasValidWorkspace() first and skips
// this entirely for a plain "give me my existing workspace" call. Raised
// from 3/h (which a real user could exhaust just by having a handful of
// browser tabs/reconnects all land on a call that DID need to provision -
// e.g. right at expiry, several tabs mid-navigation) to 10/h, generous
// headroom without being unbounded.
const provisionClient = aj.withRule(
    tokenBucket({
        mode: ARCJET_MODE,
        characteristics: ["userId"],
        capacity: 10,
        refillRate: 10,
        interval: "1h",
    })
);

export type RateLimitResult =
    | { ok: true }
    | { ok: false; status: number; body: Record<string, unknown> };

// Called directly from the route handler (not mounted as blanket middleware)
// so it only ever runs on the expensive path - see the module comment above.
export const checkProvisionRateLimit = async (req: Request, userId: string): Promise<RateLimitResult> => {
    try {
        const arcjetRequest: ArcjetNodeRequest & { userId: string } = {
            headers: req.headers,
            method: req.method,
            url: req.originalUrl ?? req.url,
            socket: { remoteAddress: req.socket.remoteAddress ?? req.ip ?? "0.0.0.0" },
            userId,
        };

        const decision = await provisionClient.protect(arcjetRequest, { userId, requested: 1 });

        if (decision.isDenied() && decision.reason.isBot()) {
            return { ok: false, status: 403, body: { error: "Forbidden.", message: "Automated requests are not allowed." } };
        }
        if (decision.isDenied() && decision.reason.isShield()) {
            return { ok: false, status: 403, body: { error: "Forbidden.", message: "Request blocked by security policy." } };
        }
        if (decision.isDenied() && decision.reason.isRateLimit()) {
            return {
                ok: false,
                status: 429,
                body: {
                    error: "Too many requests.",
                    message: "Too many workspace provisioning attempts - please wait a bit before trying again.",
                    retryAfter: 3600,
                },
            };
        }
        return { ok: true };
    } catch (e) {
        console.error("Workspace provisioning rate limit error", e);
        return { ok: false, status: 500, body: { error: "Internal Server Error" } };
    }
};

// Kept as a thin adapter for any call site still wired as blanket middleware
// (none in this codebase after C4, but the standalone function above is the
// one to reach for from a handler that needs to gate conditionally).
export const applyProvisionRateLimit = (res: Response, result: RateLimitResult): boolean => {
    if (result.ok) return true;
    if (result.status === 429) res.setHeader("Retry-After", "3600");
    res.status(result.status).json(result.body);
    return false;
};
