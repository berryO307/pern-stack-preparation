import type { Request } from "express";
import type { ArcjetNodeRequest } from "@arcjet/node";
import { tokenBucket } from "@arcjet/node";
import aj, { ARCJET_MODE } from "../config/arcjet.js";

// Rate-limits FAILED invite-code attempts specifically (not every enrollment
// POST) - a 6-character code is a small space, so an unthrottled code field
// is a guessing oracle. Called explicitly at each point in the validation
// chain where a code-related check fails, not as blanket route middleware,
// since well-formed/successful submissions shouldn't count against it.
const codeAttemptClient = aj.withRule(
    tokenBucket({
        mode: ARCJET_MODE,
        characteristics: ["userId"],
        capacity: 10,
        refillRate: 10,
        interval: "10m",
    })
);

// Returns false once the budget is exhausted; the caller should respond 429
// instead of the normal field-scoped 422 in that case.
export const recordFailedCodeAttempt = async (req: Request, userId: string): Promise<boolean> => {
    const arcjetRequest: ArcjetNodeRequest & { userId: string } = {
        headers: req.headers,
        method: req.method,
        url: req.originalUrl ?? req.url,
        socket: { remoteAddress: req.socket.remoteAddress ?? req.ip ?? "0.0.0.0" },
        userId,
    };

    const decision = await codeAttemptClient.protect(arcjetRequest, { userId, requested: 1 });
    return !decision.isDenied();
};
