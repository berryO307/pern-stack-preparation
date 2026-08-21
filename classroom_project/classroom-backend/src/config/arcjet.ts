import arcjet, {shield, detectBot, tokenBucket, slidingWindow} from "@arcjet/node";
import {NextFunction} from "express";

if ((!process.env.ARCJET_KEY && process.env.NODE_ENV !== 'test')) {
    throw new Error("Invalid ARCJET_KEY environment variable");
}

const aj = arcjet({
    key: process.env.ARCJET_KEY!,
    rules: [
        shield({ mode: "LIVE" }),
        detectBot({
            mode: "LIVE",
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
            mode: "LIVE",
            interval: '2s',
            max: 25,
        }),
    ],
});

export default aj;