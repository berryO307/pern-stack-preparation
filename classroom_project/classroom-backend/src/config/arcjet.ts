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
        slidingWindow({
            mode: "LIVE",
            interval: '2s',
            max: 5,
        }),
    ],
});

export default aj;