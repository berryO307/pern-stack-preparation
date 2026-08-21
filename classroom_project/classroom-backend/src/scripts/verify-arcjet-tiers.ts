import "dotenv/config";
import { randomUUID } from "crypto";
import authRateLimit from "../middleware/authRateLimit.js";
import workspaceProvisionRateLimit from "../middleware/workspaceProvisionRateLimit.js";
import domainWriteRateLimit from "../middleware/domainWriteRateLimit.js";

// Standalone verification - run manually with `tsx src/scripts/verify-arcjet-tiers.ts`.
// Calls each rate-limit middleware directly (bypassing HTTP) with a realistic
// browser-like header set, so Arcjet's bot detection doesn't confound the
// rate-limit assertion the way it does with curl's minimal header set.

const BROWSER_HEADERS = {
    "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
    "accept-encoding": "gzip, deflate, br",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
};

function makeReqRes(overrides: Record<string, unknown> = {}) {
    const state: { statusCode?: number; body?: unknown; nextCalled: boolean } = { nextCalled: false };

    const req = {
        headers: BROWSER_HEADERS,
        method: "POST",
        originalUrl: "/test",
        socket: { remoteAddress: "203.0.113.42" },
        ip: "203.0.113.42",
        ...overrides,
    } as any;
    const res = {
        setHeader() {},
        status(code: number) {
            state.statusCode = code;
            return this;
        },
        json(payload: unknown) {
            state.body = payload;
            return this;
        },
    } as any;
    const next = () => {
        state.nextCalled = true;
    };

    return { req, res, next, state };
}

async function testAuthRateLimit() {
    console.log("\n=== Tier 1: auth routes (fixed window, 10/min per IP) ===");
    let firstDenyAt: number | null = null;

    for (let i = 1; i <= 13; i++) {
        const { req, res, next, state } = makeReqRes();
        await authRateLimit(req, res, next);
        if (!state.nextCalled && firstDenyAt === null) {
            firstDenyAt = i;
            console.log(`request ${i}: DENIED - status=${state.statusCode} body=${JSON.stringify(state.body)}`);
        }
    }

    console.log(`first denial at request #${firstDenyAt}`);
    if (firstDenyAt !== 11) {
        throw new Error(`FAIL: expected the 11th request to be the first denial, got #${firstDenyAt}`);
    }
    console.log("PASS");
}

async function testWorkspaceProvisionRateLimit() {
    console.log("\n=== Tier 2: workspace provisioning (token bucket, 3/hour per user) ===");
    const userId = randomUUID();
    let firstDenyAt: number | null = null;

    for (let i = 1; i <= 5; i++) {
        const { req, res, next, state } = makeReqRes({ user: { id: userId, role: "student" } });
        await workspaceProvisionRateLimit(req, res, next);
        if (!state.nextCalled && firstDenyAt === null) {
            firstDenyAt = i;
            console.log(`request ${i}: DENIED - ${JSON.stringify(state.body)}`);
        }
    }

    console.log(`first denial at request #${firstDenyAt}`);
    if (firstDenyAt !== 4) {
        throw new Error(`FAIL: expected the 4th request to be the first denial, got #${firstDenyAt}`);
    }
    console.log("PASS");
}

async function testDomainWriteRateLimit() {
    console.log("\n=== Tier 3: domain writes (token bucket, 20/min per user) ===");
    const userId = randomUUID();
    let firstDenyAt: number | null = null;

    for (let i = 1; i <= 22; i++) {
        const { req, res, next, state } = makeReqRes({ user: { id: userId, role: "student" } });
        await domainWriteRateLimit(req, res, next);
        if (!state.nextCalled && firstDenyAt === null) {
            firstDenyAt = i;
            console.log(`request ${i}: DENIED - ${JSON.stringify(state.body)}`);
        }
    }

    console.log(`first denial at request #${firstDenyAt}`);
    if (firstDenyAt !== 21) {
        throw new Error(`FAIL: expected the 21st request to be the first denial, got #${firstDenyAt}`);
    }
    console.log("PASS");
}

async function main() {
    await testAuthRateLimit();
    await testWorkspaceProvisionRateLimit();
    await testDomainWriteRateLimit();
    console.log("\nALL PASS");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
