# Academic Hub — Engineering Deep Dive

This is the reference document for explaining *why* this project is built the way it is — not a feature list, a decision log. Every claim below is backed by something concrete: a forced-failure test against the live database, a live query, a grep of an installed library's own source, or a reproduced bug. Where something was investigated and did **not** turn out to be a real problem, that's written down too — that discipline (verify, don't assume) is itself one of the things worth talking about.

Live demo: https://ums-pern-stack.vercel.app · API: https://ums-pern-stack.up.railway.app

---

## 1. The core architectural problem: a public multi-tenant demo

A "try it yourself" university management system has one hard requirement that a normal internal app doesn't: **any number of strangers can show up at once, and none of them should see or corrupt anyone else's data** — while still feeling like a real, populated system, not an empty shell.

The design: every signed-in visitor gets their own `demo_workspaces` row (`workspaceId`), and every domain table (`departments`, `subjects`, `classes`, `enrollments`) carries a `workspace_id` foreign key. Every route scopes its query to `req.workspaceId`, resolved once per request by `middleware/workspace.ts`. Teachers and students are the one exception — they're drawn from a **global, workspace-agnostic fixture pool** (`STUDENT_POOL_SIZE=140`, `TEACHER_POOL_SIZE=13`, deterministic via `NAME_POOL_SEED=42`) shared across every workspace via an upsert-by-email pattern (`onConflictDoNothing`), so the same 140 fictional students exist once in the `user` table and get re-linked (not re-created) into each new workspace's classes and enrollments. This keeps seeding cheap (~950 rows written, not ~950 *new* rows) without ever mixing one visitor's actual submitted data into another's view.

### Why this is harder than it sounds: three failure modes a naive version has

1. **Partial provisioning.** Seeding is dozens of inserts. If step 40 of 60 throws, what's left behind?
2. **Duplicate provisioning.** A page load fires several parallel requests; if two race to provision the same new user's workspace, do you get one workspace or two half-built ones?
3. **A workspace nobody ever repairs.** If #1 happens once, does anything ever notice and fix it, or does it just sit there broken?

Each of these was a real, reproducible gap in an earlier version of this code — not hypothetical. Sections 2–4 cover how each was closed, and how each fix was *proven*, not just written.

---

## 2. Atomicity: the transaction that couldn't be built on the first driver

**The gap.** `provisionWorkspace` used to run as three separate, independently-committing steps: insert the workspace row → run `seedWorkspace()` (many individual inserts) → update `seededAt`. Nothing wrapped these together. A crash between steps left a `demo_workspaces` row with `seededAt: null` and however many domain rows had been written before the failure — a partial workspace, and nothing ever noticed.

**The blocker.** The fix is obvious — wrap it all in `db.transaction(...)` — except the project's original Postgres driver, `drizzle-orm/neon-http` (`@neondatabase/serverless`'s HTTP-based `neon()` client), **does not support transactions at all**. This wasn't assumed; it was confirmed by grepping the installed package's own compiled output:

```
$ grep -r "No transactions support" node_modules/drizzle-orm/neon-http/
dist/neon-http/session.js:  throw new Error("No transactions support in neon-http driver")
```

`neon-http` exists specifically for serverless/edge environments that can't hold a persistent connection — it issues each query as its own HTTP request, which is architecturally incompatible with a multi-statement transaction. But this backend runs on Railway as a long-lived Node process, not a serverless function, so that tradeoff was buying nothing.

**The fix.** Switched to `drizzle-orm/neon-serverless`, which uses `@neondatabase/serverless`'s WebSocket-based `Pool` — a real, long-lived Postgres connection that supports interactive transactions:

```ts
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);
```

This required a new runtime dependency (`ws`) and touched every call site that used the old driver's `db.batch([...])` workaround for pseudo-atomicity (`routes/enrollments.ts`'s enrollment-capacity check, and its own race-condition test script) — both converted to real `db.transaction()` blocks with the exact same locking logic (`SELECT ... FOR UPDATE` + conditional insert) preserved.

**The proof.** Rather than trust the transaction wrapper by inspection, I broke it on purpose against the live database: a `Proxy`-wrapped transaction client that throws on the 3rd class insert, invoked through the real `provisionWorkspace` path. Result: **zero rows survived** — the department and subject rows inserted before the throw rolled back along with everything after it. That's the actual bar for "atomic," not "the code compiles and looks right."

---

## 3. Idempotency and self-healing

Atomicity alone only guarantees a workspace is either **fully seeded or doesn't exist** — it doesn't stop a *new* request from re-triggering provisioning while a previous one is still ambiguous, or leave a way to recover a workspace that was somehow left incomplete before this fix shipped.

- **`resolveWorkspace`** treats `seededAt === null` (an incomplete row — exactly what a pre-fix crash could leave behind) identically to an expired row: delete and silently re-provision on the very next request that touches it. Combined with the transaction from §2, a `demo_workspaces` row can now only ever be in one of two states — fully seeded, or gone — with no reachable state in between.
- **Client-side single-flight guard** (`use-workspace.ts`): `POST /workspace` is safe to call any number of times (idempotent), so there's no correctness reason to call it more than once — but there's also no reason to. `staleTime: Infinity` plus disabling React Query's refetch-on-mount/focus/reconnect means a normal page only ever calls it once per session, not once per re-render or tab-focus.
- **Health endpoint** (`GET /workspace/health`): runs a set of invariant checks against the caller's own workspace — seeded, every domain table non-empty with no future-dated rows, all 5 capacity buckets populated, all 12 trailing months represented in enrollments, the 4 KPI counts pairwise distinct, no orphaned `workspace_id`-null rows system-wide. Turns "my dashboard numbers look different from yours" into a request either person can run, instead of comparing screenshots.
- **Backfill script** (`backfill-workspace-invariants.ts`): runs those same invariants across every existing workspace and re-provisions any that fail — the same atomic, idempotent path a normal sign-in uses, just invoked directly. Before running it for real against production data, it was run **dry-run first**, specifically to confirm it wouldn't misjudge the admin's manually-curated permanent workspace as "broken" and destructively wipe real data. Only after that came back clean did the real (destructive-capable) run happen: `Healthy: 4. Repaired: 0. Unrepairable: 0.`

---

## 4. Rate limiting that matches the actual threat model

Provisioning a workspace is the one genuinely expensive operation in this app (~950 rows). Arcjet enforces a token-bucket limit on it — but the limit's *design*, not just its number, changed:

- **Before:** blanket middleware on every `POST /workspace` call, 3 requests/hour.
- **The problem:** since idempotency (§3) makes repeat calls to an *already-provisioned* workspace free and harmless, spending rate-limit budget on them was pure downside — a legitimate user with a few browser tabs open, or reconnecting right as their workspace happened to expire, could lock themselves out of their own workspace.
- **After:** `checkProvisionRateLimit` is a plain function the route calls conditionally — only when `hasValidWorkspace()` is false and a provision is actually about to happen. Capacity raised to 10/hour, since idempotency (not the rate limit) is now the real defense against repeated calls.

**Verification caveat worth knowing cold:** Arcjet runs in `DRY_RUN` mode (logs decisions, never blocks) whenever `NODE_ENV !== "production"` — intentional, for local dev ergonomics. That means a plain local test run of the rate limiter *always* shows every request succeeding, regardless of whether the logic is right. Testing it for real requires forcing `NODE_ENV=production` for that one run. Doing that against the live rate limiter confirmed the new config exactly: 10 requests succeed, the 11th is denied with `429`. (It also surfaced a pre-existing, unrelated off-by-one in a *different* rate limiter's test — documented as found-but-out-of-scope rather than silently fixed or silently ignored, since attributing it to this change would have been dishonest.)

---

## 5. The OAuth/cookie bug: split-domain deploys and Safari's ITP

**The report:** a user on iPhone Safari signed in with Google and landed on the bare backend's root route (`https://…up.railway.app/` — literally the text "Classroom backend is up and running!"), with no session.

**Root cause, in order of discovery:**

1. **No explicit `baseURL`** on the `betterAuth({...})` config. Better Auth infers `baseURL` from whichever host physically receives a request — and since the OAuth `redirect_uri` sent to Google is derived from `baseURL`, an unset value meant Google's callback landed on Railway directly, not the frontend.
2. **The auth client's `baseURL` pointed straight at Railway** (`BACKEND_BASE_URL` with `/api` stripped), so every auth call — sign-in, session checks — went browser → Railway cross-origin, not through the frontend.
3. **The cookie was `SameSite=None; Secure`** — the standard cross-site fallback. Safari's Intelligent Tracking Prevention (and iOS Chrome, which uses WebKit under the hood regardless of "Chrome" branding) blocks third-party cookies by default, and a cookie set by a different registrable domain (`railway.app` vs `vercel.app`) than the page the browser is looking at *is* third-party, no matter how correctly `SameSite`/`Secure` are configured.

**The fix — make the cookie first-party, not "make the cross-site case work better":**

- **`vercel.json`** rewrites `/api/(.*)` to the Railway backend, ahead of the SPA catch-all; **`vite.config.ts`** does the equivalent for local dev. The browser now only ever talks to its own origin for every backend call.
- Auth client's `baseURL` → `window.location.origin`.
- Backend's `baseURL` → explicit `process.env.FRONTEND_URL` (no longer inferred from request host), with a startup guard that throws if it's missing or still `localhost` in production.
- Cookie attributes → `SameSite=Lax` (correct now that everything is same-origin — no reason to keep the cross-site fallback).
- `GET /` on the backend now 302s to the frontend instead of showing a bare status string, and a catch-all does the same for any other stray HTML navigation that reaches the backend directly — so even a stale bookmark or an OAuth provider that hasn't picked up the redirect-URI change yet lands somewhere useful instead of a dead end.

`vercel.app` and `up.railway.app` are both on the Public Suffix List, so "just use a shared parent domain" was never on the table — the proxy is the actual fix, not a workaround.

### A second, quieter finding in the same investigation: the account-linking gap

Reading Better Auth's own linking code (`oauth2/link-account.mjs`) while investigating the above surfaced something unrelated but real: the project had `trustedProviders: ["google", "github"]` set, which — per the library's own guard clause — **skips checking the incoming sign-in's own `emailVerified` flag**, gating only on the *existing stored* account's verification. Concretely: an attacker-controlled GitHub account with an unverified email claiming a real user's address could still link into that user's account, as long as the existing account already had `emailVerified: true`. Removed `trustedProviders` entirely, falling back to Better Auth's default (require verified on both sides) — both providers already report `emailVerified` accurately, so this closed a real gap with zero functional loss.

---

## 6. Privacy: a public demo roster must never leak real people

**The report:** friends who signed in with their own real Google accounts to try the demo had their real name and email visible to *every other visitor* in the Students/Faculty list.

**Root cause:** `GET /users` (which the Faculty and Students pages both reuse, filtered by `role` query param) queried the raw `user` table with no distinction between the seeded fixture pool and real OAuth sign-ins. Every real account — including the admin's own — was globally visible to any other authenticated visitor.

**The fix:** fixture users are inserted directly by the seed script and never get a matching `account` row (that row only gets created by an actual OAuth sign-in). That's a clean, existing signal for "is this a real person or fictional roster data" — the same one an earlier `real_users` database view used. Applied as a `NOT EXISTS` condition against `account`, on both the list/count query and the `GET /users/:id` detail lookup (so a real account can't be reached by guessing its ID after being hidden from the list):

```ts
const isFixtureUser = notExists(
    db.select({ id: account.id }).from(account).where(eq(account.userId, user.id))
);
```

**Verified against live data, not just typechecked:** of 311 total `user` rows, exactly 6 were hidden by this change, and all 6 were confirmed to be real accounts (5 reported plus the admin's own) — the other 305 fixture rows were untouched.

**An incidental type-safety bug this surfaced:** switching `GET /users/:id`'s lookup from a raw `sql` template to a typed `eq()` call exposed that Express 5's types define `req.params.id` as `string | string[]`, not `string` — a real gap that had been silently swallowed by the untyped template string before. Fixed with an explicit `String(req.params.id)` coercion, matching the `Number(req.params.id)` pattern already used for numeric-ID routes elsewhere in the codebase.

---

## 7. Frontend framework quirks that only show up under real use

These weren't guessed at — each was root-caused by reading the actual behavior (library internals, live DOM measurements, or a real forced repro) before writing a fix.

### Refine's `useTable` silently reverts role-scoped filters

**Symptom:** navigating to Faculty/Students *from the home dashboard's link* broke pagination and filtering; navigating to the same pages from the sidebar worked fine. Classes and Subjects were unaffected either way.

**Root cause:** `@refinedev/core`'s internal `useTable` has an effect that resets `filters`/`currentPage`/`sorters` to defaults whenever the parsed URL has no query string — and it re-fires through the whole mount sequence, reverting any filter pushed through the normal `filters` channel *regardless of timing*. Faculty/Students used `filters` to scope by role (`role=teacher`/`role=student`); Classes/Subjects didn't need any equivalent scoping, which is why they were unaffected.

**Fix:** route role-scoping through Refine's `meta` parameter instead — untouched by that reset effect — consumed in the data provider's `buildQueryParams`.

A second, related bug in the same feature: a KPI card's preset role (passed via React Router `state`) was lost on the home-route path specifically because **`state` doesn't survive `syncWithLocation`'s own `history.replace()` calls** — Refine's location sync does its own replace, which drops router state that was there a moment earlier. Fixed by capturing it into a `useRef` on mount instead of reading it fresh every render.

### Mobile viewport bugs: two different CSS defaults biting the same way

- **Charts forcing horizontal overflow:** a Recharts SVG inside a flex/grid card ignored the card's intended width because **flex/grid items default to `min-width: auto`** — their minimum size is their content's intrinsic size unless something overrides it. Fixed with an explicit `min-w-0` on the chart's container.
- **A chart silently rendering at 0 height** despite an explicit `h-64` class: `flex-1` sets `flex-basis: 0%`, and in that specific component's flex-column ancestor chain (an extra headline-stat sibling the simpler capacity chart didn't have), the flex-grow distribution resolved to zero — so the *computed* height was `0px` despite the class being present in markup. Confirmed via `getBoundingClientRect()`/`getComputedStyle()` on the live page, not guessed. The identical class combination worked fine on a sibling component with a simpler ancestor chain — which is exactly why this class of bug survives code review and only shows up live.
- **The mobile sidebar drawer never closing after navigation:** the mobile nav renders as a Radix `Sheet` fixed at `18rem` (288px) wide, and no click handler ever closed it. On a ~390px phone, that leaves only ~100px of the destination page visible behind the drawer — which is what a "broken show page, everything's thin, description missing" bug report actually was. Fixed by wiring `setOpenMobile(false)` into every sidebar nav link's `onClick`.

The throughline across all three: **the bug was never in the business logic** — it was in a CSS/framework default nobody looks at until a real device exposes it. Investigating by reproducing the exact symptom (DOM measurement, live pixel math) rather than guessing from a code read is what actually found each root cause.

---

## 8. Observability

- **Site24x7 RUM** (`classroom-frontend/index.html`) — real user monitoring on the frontend; the beacon's `appKey` is deliberately public (it has to ship in client HTML to work at all, the same as any analytics tag), not a credential.
- **Site24x7 APM Insight** (`AgentAPI.config()` at the top of `classroom-backend/src/index.ts`) — backend transaction/response-time tracing, a separate product from RUM.
- Both were verified live rather than assumed configured correctly: checked the actual Site24x7 monitor dashboard, confirmed 0 Down/Critical/Trouble across both, and traced a third dashboard entry ("Component Data Lake," never polled) to being a Site24x7 platform default that ships with eval accounts, not anything this app configured.

---

## 9. Infrastructure hygiene (Neon)

On a public demo, the database's own dashboard settings matter as much as the app code:

| Setting | Verified live value | Assessment |
|---|---|---|
| Auto-suspend delay | 5 minutes (Free plan default, not user-configurable) | Correct for a bursty/sparse workload |
| Autoscaling ceiling | 0.25 ↔ 2 CU | Above the ideal cap for this workload, but low-risk: Free plan is hard-capped (compute-hours/storage/transfer), not billed, so there's no runaway-cost exposure — a wider ceiling just burns the monthly compute-hour quota faster under a spike |
| History window (PITR/WAL retention) | 6 hours (plan max) | Same reasoning — no cost exposure on Free plan, left as-is |
| Stale branches | 1 branch total, 1/10 used | Nothing to clean up |
| Usage/billing alerts | No such setting exists in the console for a Free (capped, not billed) plan | Not a gap — the feature doesn't apply to this plan tier |

---

## 10. Bugs fixed — quick-reference table (for interview storytelling)

| Bug | Root cause | Verification |
|---|---|---|
| Faculty/Students pagination broken via home-route link only | Refine's `useTable` resets `filters` on empty query string; role-scoping used `filters` | Reproduced the exact nav path; fixed via `meta` instead |
| Workspace could be left half-seeded on crash | 3 non-transactional write steps, no driver-level transaction support | Forced-failure test against live DB: proved zero rows survive a mid-seed throw |
| Charts overflowing horizontally on mobile | Flex/grid item `min-width: auto` default | Fixed with `min-w-0`; same root cause class as issue below |
| A chart rendering at 0px height | `flex-1` → `flex-basis: 0%` in a specific ancestor chain | `getBoundingClientRect()` on live page confirmed 0px before, 256px after |
| Mobile sidebar stuck open, "show" pages looked broken | Sheet drawer (288px) never closed on nav, covering ~74% of a 390px screen | Root-caused via the math (288px of 390px), fixed with `setOpenMobile(false)` on nav click |
| iPhone Safari sign-in stranded on bare backend URL | Cross-site cookie (different registrable domains) blocked by ITP; `baseURL` not explicit | Same-origin proxy + explicit `baseURL`; documented what couldn't be verified without physical device access |
| Real visitors' PII exposed in public Students/Faculty list | `GET /users` queried the raw table with no fixture-vs-real distinction | Live query: 311 rows → 6 correctly hidden, matching the exact people reported |
| Account-linking could bypass email-verification check | `trustedProviders` config skipped the incoming sign-in's own `emailVerified` | Found by reading Better Auth's own linking source, not assumed |

---

## Principles this project follows (worth saying explicitly in an interview)

1. **Verify against the real system, not the code you just wrote.** Nearly every fix above has a corresponding live query, forced-failure test, or DOM measurement proving it — not just "the logic looks right."
2. **When an investigation doesn't reproduce a hypothesized bug, say so.** A separate investigation into a suspected "truncated seed" data-integrity bug found the hypothesis didn't hold up against live data — documented honestly rather than forcing a fix onto a bug that wasn't there, while still shipping the atomicity/idempotency work because *that* risk was real regardless.
3. **Read the library's actual source before trusting its behavior**, especially for security-relevant config (`trustedProviders`, the neon-http transaction limitation, Arcjet's DRY_RUN mode).
4. **A bug reproduced on a real device/browser class beats a bug reasoned about from a code read** — the mobile CSS bugs and the OAuth cookie bug were both root-caused by understanding what the *actual runtime environment* (WebKit ITP, a 390px viewport, a specific flex ancestor chain) does differently, not by staring at the component code in isolation.
