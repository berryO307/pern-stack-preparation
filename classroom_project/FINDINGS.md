# Dashboard data bug — investigation findings

Investigated 2026-08-24, against the live permanent workspace (`ee09a5f8-c547-4fa3-9e75-76debefb1e3e`), by running the queries below directly (`src/scripts/_tmp-investigate-kpi.ts`, deleted after this report was written). Every number below is pasted script output, not inferred from reading the code.

## Root cause: confirmed, not inferred

**The KPI query and the capacity chart query were never inconsistent with each other — they answer two different questions, and only one of them is labeled correctly.**

- `capacityDistribution` sums to the true total (29 classes) because it counts every row.
- The KPI card's `classes_current` value counts only rows whose `created_at` falls in the *current calendar month*. It is a flow metric ("classes added this month"), not a total, wearing a "Total" label it never earned. Same mechanism for `faculty_current` and `subjects_current`.

### Evidence

**Step 2 — ground truth totals, scoped to the permanent workspace:**
```
students (distinct enrolled): 228
faculty  (distinct teacher_id on classes): 20
classes: 29
subjects: 18
```

**Step 2b — identical unscoped totals** — ruling out a workspace_id scoping mismatch between the KPI query and the chart query; both already filter on the same `workspace_id` and returned the same numbers with the filter removed entirely (this workspace is the only one with real data in the dev DB right now).

**Step 4 — period hypothesis, run directly against `classes`:**
```json
{ "total": "29", "this_month": "3", "last_month": "2" }
```
This confirms the hypothesis exactly: the dashboard's `classes_current`/`classes_previous` are `this_month`/`last_month` from this query, not `total`. (The card showed "2" earlier in the session; it now shows "3" because a real class — "Data Structures - Lab" — was created live through the UI since then, moving the current-month count from 2 to 3. The mechanism is confirmed either way.)

**Ruled out:**
- Workspace scoping mismatch — Step 2 vs 2b identical, both filters present in both existing queries.
- Join fanout / `count(*)` vs `count(distinct …)` — `faculty`/`students` already use `count(distinct …)` in the existing query; re-running by hand matches the app's own numbers exactly.
- Two different endpoints — confirmed by reading `routes/dashboard.ts`: KPIs and `capacityDistribution` are both computed inside the same `runSummaryQuery` function, one round trip, one endpoint (`GET /dashboard/summary`). They were never structurally separate; the discrepancy is purely the period-vs-total semantic mismatch above.

## B1 — future-dated rows: confirmed, real, separate bug

**Step 6, scoped:**
```json
[
  { "t": "classes", "n": "1" },
  { "t": "enrollments", "n": "1" },
  { "t": "subjects", "n": "0" },
  { "t": "departments", "n": "0" }
]
```

**Server clock at query time:** `pg now() = 2026-08-23 23:26:36.750453+00`, `js now() = 2026-08-23T23:26:38.533Z` — server and app clocks agree; this is not a client/server clock skew.

**The two offending rows:**
```json
{ "id": 524, "name": "Data Structures - Lab", "created_at": "2026-08-24 06:07:04.266", "is_future": true }
{ "id": 19503, "created_at": "2026-08-24 16:44:57.643", "is_future": true }
```

Class 524 was created live through the app's own "Create a class" flow during this session (confirmed by its presence in Recent Activity as "New class... was created"), which uses `defaultNow()` — a value Postgres assigns at insert time and which cannot itself be ahead of a later `now()` call on the same server. The most likely explanation is that the sandbox/dev environment's wall clock rolled over to 2026-08-24 partway through this long session while the seed/repair scripts (which explicitly compute and set `created_at`, rather than relying on `defaultNow()`) were still using an earlier captured reference — i.e., a script run right at that date boundary. Rather than chase the exact millisecond further, this is treated as data to repair and prevent going forward (below), since the mechanism doesn't change the fix.

**Step 7 — enrollment distribution, scoped (all 12 trailing months present, no gaps):**
```
2025-09: 176   2025-10: 25   2025-11: 32   2025-12: 102
2026-01: 210   2026-02: 62   2026-03: 50   2026-04: 62
2026-05: 57    2026-06: 46   2026-07: 60   2026-08: 127
```
Real month-to-month variation (25 to 210), not flat — the back-dating from the earlier repair pass is intact and will produce a genuinely non-flat enrollments-per-month chart.

## Fix applied

1. KPI cards changed to report true totals (`value` = `count(*)`/`count(distinct …)` with no date filter — the exact same query the capacity chart's total is built from) with `previous` redefined as the same total *as of the end of last month* (cumulative, not "created only last month"), so the month-over-month delta is a real growth-rate on a real total instead of a mismatched label.
2. The 2 future-dated rows are clamped to the server's current `now()`.
3. A `created_at > now()` check was added to the seed/repair path so this can't ship silently again.
4. `classesCount` (used by the Classes KPI) and the capacity distribution buckets are now computed from the *same* base `classes` query in `routes/dashboard.ts`, so the two numbers are structurally tied together rather than independently re-derived — verified by `src/scripts/verify-kpi-capacity-parity.ts`.

## Chart redesign — capacity donut → bar, fill-rate → enrollments trend

Both charts were rebuilt per the brief (`capacity-bar-chart.tsx`, `enrollments-trend-chart.tsx`), replacing `capacity-donut-chart.tsx`/`fill-rate-trend-chart.tsx` (deleted).

**Bug found and fixed during verification — capacity bar chart, wrong absolute scale:** the horizontal `BarChart`'s numeric `<XAxis type="number" hide>` had no explicit `domain`, so bars rendered at the correct *relative* proportions but a near-zero absolute scale (confirmed via DOM inspection of rendered `<path>` `width` attributes). Fixed with `domain={[0, "dataMax"]}`.

**Bug found and fixed during verification — enrollments trend chart, not rendering at all:** the chart's headline stat and peak-month caption rendered correctly (proving the data pipeline was fine), but no `.recharts-wrapper` existed in the DOM and the chart's `role="img"` wrapper measured `height: 32px` instead of the expected ~280px. Root cause, confirmed via `getBoundingClientRect()`/`getComputedStyle()` on the live page: the `ChartContainer` div had `className="... h-64 w-full flex-1"` — Tailwind's `flex-1` sets `flex-basis: 0%`, and inside this component's specific `flex-col` ancestor chain (an extra headline-stat sibling above the chart, absent from the capacity chart's simpler layout) the flex-grow distribution resolved to zero, so the element's *computed* `height` was `0px` despite the explicit `h-64` class being present in the source. The capacity chart uses the identical `h-64 ... flex-1` pattern and happens to resolve non-zero in its own (simpler) flex chain — same class combination, different runtime outcome, which is why code review alone didn't catch it. Fixed by dropping `flex-1` from the enrollments chart's `ChartContainer` (`aspect-auto h-64 w-full`), so the fixed height applies unconditionally. Verified live: `.recharts-wrapper` present, chart height 256px, real bars rendered matching the 12-month distribution in Step 7 above (peak Jan 2026 ≈ 210, low Oct 2025 ≈ 25).

## Sign-in stranding on the backend's bare root route (iOS Safari/Chrome), and profile completeness

Investigated 2026-08-24, triggered by a real report: a user on iPhone Safari signed in with Google and landed on `https://ums-pern-stack.up.railway.app/` — the bare text `Classroom backend is up and running!` — instead of the app, with no session.

### Evidence gathered — real, not inferred

**Config as it stood before this fix**, read directly from source:
- `classroom-backend/src/lib/auth.ts`: no `baseURL` set on the `betterAuth({...})` call at all. Better Auth infers it from whatever host actually receives the request when unset.
- `classroom-backend/src/lib/auth.ts`: `advanced.defaultCookieAttributes` was `{ sameSite: "none", secure: true }` in production — the cross-site fallback, not first-party.
- `classroom-frontend/src/lib/auth-client.ts`: `authClient`'s `baseURL` was `BACKEND_BASE_URL` with `/api` stripped — i.e. the Railway origin directly. Every auth call (`signIn.social`, session checks) went browser → Railway, cross-origin, not through the frontend.
- `classroom-frontend/src/providers/auth.ts` (already had a prior, partial fix in place, with its own comment explaining exactly this failure mode): `signIn.social({ provider, callbackURL: `${window.location.origin}/` })` — an absolute frontend URL was already being passed as the *post-login* redirect target. This was not sufficient on its own: Better Auth's OAuth `redirect_uri` (the URL Google itself redirects back to, which must be Better Auth's own server-side callback route since that's what exchanges the code) is derived from `baseURL`, not `callbackURL` — and with no explicit `baseURL`, that resolved to Railway regardless of what `callbackURL` said.
- `classroom-backend/src/index.ts`: `GET /` returned the plain text confirmed in the bug report, with no styling and no link back to the app.

**curl verification could not be completed as specified.** Part B7 of the brief asked for `curl -i` output against the live callback route. Both `curl "https://.../api/auth/callback/google?code=test&state=test"` and even `curl "https://.../"` (the bare root) returned `403 {"error":"Forbidden.","message":"Automated Requests are not allowed."}` — Arcjet's `shield`/`detectBot` middleware (`config/arcjet.ts`, `ARCJET_MODE=LIVE` in production) blocks non-browser traffic ahead of every route, including the harmless root. This is documented here rather than papered over with fabricated output: the redirect-URL diagnosis above is verified from source, not from a captured `Location` header.

**Real database check** (307 `user` rows, live permanent workspace):
```
user table counts: { total: '307', missing_name: '0', missing_email: '0', missing_image: '0' }
account provider_id distribution: [ { provider_id: 'google', n: '2' } ]
rows with empty (not null) name/email: []
```
`name`/`email` are `NOT NULL` columns (`db/schema/auth.ts`), so a broken profile shows up as an empty string, not null — checked for both. Zero broken rows exist right now. Only 2 rows are real OAuth accounts (both Google); the other 305 are seeded workspace fixtures, not sign-ins. This means **the private-email GitHub scenario (Part E2/E8's actual test) has not been exercised against real data** — there is no GitHub account in this database to have failed. That test still needs a human with a real GitHub account whose email is set to private.

**Better Auth's GitHub provider already does what Part E2 asked for**, confirmed by reading the installed package source (`node_modules/@better-auth/core/src/social-providers/github.ts`, better-auth 1.6.29): requests `["read:user", "user:email"]` by default, calls `GET https://api.github.com/user/emails` and falls back to the primary (or first) verified address when `profile.email` is null, computes `emailVerified` from that email's own `verified` flag, and falls back to `profile.login` when `profile.name` is empty. None of that needed reimplementing — it already matches the brief's E2 spec.

**Account linking gap found that the brief's E5 concern was actually right about**, confirmed by reading `node_modules/better-auth/dist/oauth2/link-account.mjs`: the linking guard is `if (!isTrustedProvider && !userInfo.emailVerified || requireLocalEmailVerified && !dbUser.user.emailVerified || ...) { block }`. With `trustedProviders: ["google", "github"]` set (as this app had it), `isTrustedProvider` is `true` for both, which makes the first clause `false` regardless of the *incoming* sign-in's own `emailVerified` — only the *existing stored* account's verification status still gates it. Concretely: a GitHub account with an **unverified** email claiming a real user's address could still be linked into that user's account, provided the existing account already had `emailVerified: true`. Both providers already report `emailVerified` accurately (Google's `id_token` claim; GitHub's own `/user/emails` `verified` flag), so removing `trustedProviders` and relying on Better Auth's default (require verified on *both* sides) closes this with no functional loss.

### Fix applied

1. `vercel.json`: added an `/api/(.*)` rewrite to the Railway backend, ahead of the SPA catch-all. `vite.config.ts`: added the equivalent dev-server proxy. The browser now only ever talks to its own origin for every backend call (auth and data), in both environments.
2. `classroom-frontend/src/lib/auth-client.ts`: `baseURL` changed from the Railway origin to `window.location.origin`.
3. `classroom-backend/src/lib/auth.ts`: `baseURL: process.env.FRONTEND_URL` set explicitly (no longer inferred from request host); cookie attributes changed from the `SameSite=None` cross-site fallback to `SameSite=Lax` (first-party, since `/api/*` is now same-origin); a startup guard throws if `FRONTEND_URL` is missing or still `localhost` in production; boot-time config logging added.
4. `classroom-backend/src/index.ts`: health-check text moved to `GET /health` (JSON); `GET /` now 302s to `FRONTEND_URL`; a catch-all redirects any other unmatched **HTML-navigation** request (matched on `Accept`, so JSON 404s for genuine unmatched API routes are unaffected) to the frontend, so no one can land on the bare backend again.
5. `classroom-backend/src/lib/auth.ts`: `account.accountLinking.trustedProviders` removed (see the gap above); `databaseHooks.user.create.before` now throws a clear `APIError` if a provider hands back no email at all, instead of letting `ADMIN_EMAILS.includes(user.email.toLowerCase())` crash on null or silently creating an unreachable account.
6. `classroom-frontend/src/lib/utils.ts`: added `displayName()` — a single name → email-local-part → `"there"` fallback chain — wired into the dashboard greeting, the sidebar user menu, and `PersonCell`. The recent-activity feed already had a SQL-level `COALESCE(stu.name, 'A student')` fallback and needed no change.
7. `classroom-backend/src/scripts/backfill-user-profiles.ts` (new): detects `user` rows with an empty name/email and repairs GitHub-provider ones via the emails API using the account's own stored (unencrypted — no token-encryption plugin configured) access token. Run against the live database: found 0 broken rows, matching the counts above.

### What this fix could not verify, and needs a human

- **Real device testing (brief Part D).** No access to a physical iPhone. iOS Safari, iOS Chrome, and in-app-browser behavior all need testing after this deploys.
- **GitHub sign-in with a private email (Part E2/E8's actual test).** No GitHub account exists in the real data to have exercised this path; code-level reading confirms Better Auth's own fallback handles it, but this is inference, not the verified result the brief's "before you finish" checklist demands.
- **Google Cloud Console / GitHub OAuth App redirect URIs.** These need updating to the frontend origin (`https://<vercel-domain>/api/auth/callback/google` and `.../github`) — requires the account owner's login, not something this fix can reach.
- **`VITE_BACKEND_BASE_URL` on Vercel.** Needs changing from the full Railway URL to `/api/` so the data provider's requests also go through the same-origin proxy (not just auth) — a dashboard env var, not a code change.
- **In-app-browser banner (Part D3).** Not built. Flagged as a real remaining gap for anyone tapping the link from inside LinkedIn/WhatsApp/Instagram, not attempted in this pass given the size of everything else in scope.
- **E4 (refresh name/avatar on every sign-in).** Better Auth's own linking code only refreshes profile fields when a *new* provider link is created (`applyUpdateUserInfoOnLink`, gated by `updateUserInfoOnLink`), not on a routine repeat sign-in with an already-linked provider — confirmed by reading `oauth2/link-account.mjs`. No documented hook covers "every sign-in, same provider" in this Better Auth version without patching internals, which felt too risky to ship blind. Left as a known, documented gap rather than a fragile guess.
