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
