import "dotenv/config";
import { sweepExpiredWorkspaces } from "./lib/cleanup.js";

// Entry point for a Railway Cron Job (Project -> New -> Cron Job -> point it at
// this repo/service). Suggested schedule: "0 0 * * *" (daily, matches the
// brief's "daily Railway cron sweep" backstop - lazy expiry on the request
// path is what actually keeps things tidy day-to-day). Command: `npm run
// cron:sweep`. Runs once and exits, rather than staying resident like the web
// server - a separate process/schedule from it, not an in-process timer.

async function main() {
    const removed = await sweepExpiredWorkspaces();
    console.log(`Workspace sweep: removed ${removed} expired workspace(s)`);
    process.exit(0);
}

main().catch((e) => {
    console.error("Workspace sweep failed", e);
    process.exit(1);
});
