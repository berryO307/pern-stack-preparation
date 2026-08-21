import type { Response, Request, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";

// Populates req.user from the better-auth session cookie, if present. Does not
// block unauthenticated requests - route-level middleware decides what's allowed.
const sessionMiddleware = async (req: Request, _res: Response, next: NextFunction) => {
    try {
        const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });

        if (session) {
            req.user = {
                id: session.user.id,
                role: session.user.role as "admin" | "teacher" | "student",
            };
        }
    } catch (e) {
        console.error("Session middleware error", e);
    }

    next();
};

export default sessionMiddleware;
