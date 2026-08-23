import arcjet, {shield, detectBot, tokenBucket, slidingWindow} from "@arcjet/node";
import {NextFunction} from "express";

if ((!process.env.ARCJET_KEY && process.env.NODE_ENV !== 'test')) {
    throw new Error("Invalid ARCJET_KEY environment variable");
}

// Every rate/bot/shield rule in this app (here and in middleware/*.ts) reads
// this instead of hardcoding "LIVE", so local dev logs decisions via
// Arcjet's DRY_RUN mode (visible in the Arcjet dashboard) instead of actually
// blocking. These limits are tuned for a public production demo's traffic
// pattern, not for a single developer reloading the page dozens of times an
// hour - without this, ordinary local iteration exhausts them (e.g.
// workspaceProvisionRateLimit's 3/hour) and blocks testing outright.
// Production (NODE_ENV=production) is unaffected either way.
export const ARCJET_MODE = process.env.NODE_ENV === "production" ? "LIVE" : "DRY_RUN";

const aj = arcjet({
    key: process.env.ARCJET_KEY!,
    rules: [
        shield({ mode: ARCJET_MODE }),
        detectBot({
            mode: ARCJET_MODE,
            allow: [
                "CATEGORY:SEARCH_ENGINE",
                "CATEGORY:PREVIEW",
            ],
        }),
        // This stacks with the per-role window in security.ts (aj.withRule adds
        // rules, it doesn't replace them) — it exists to catch synchronous
        // flooding, not to budget a single page's request count. A normal SPA
        // route change fires several concurrent calls (session check, identity,
        // page data, a few reference-data lists), easily 6-10 within 2s, so this
        // has to sit well above a legitimate burst.
        slidingWindow({
            mode: ARCJET_MODE,
            interval: '2s',
            max: 25,
        }),
    ],
});

export default aj;