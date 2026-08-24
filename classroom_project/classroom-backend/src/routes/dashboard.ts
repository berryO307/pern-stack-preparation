import express from "express";
import { db } from "../db/index.js";
import { sql } from "drizzle-orm";
import dashboardRateLimit from "../middleware/dashboardRateLimit.js";
import { requireAuth } from "../middleware/authorize.js";
import workspaceMiddleware from "../middleware/workspace.js";

const router = express.Router();

// Loose sanity check for an IANA zone name (letters/digits/_/+/-/ and /).
// Real validity is left to Postgres itself at query time — if $1 turns out to
// be bogus the query throws and the route falls back to UTC below.
const isPlausibleTimeZone = (tz: unknown): tz is string =>
    typeof tz === "string" && tz.length > 0 && tz.length < 64 && /^[A-Za-z0-9_+\-/]+$/.test(tz);

type DashboardSummary = {
    kpis: Record<
        "students" | "faculty" | "classes" | "subjects",
        { value: number; previous: number; deltaPct: number | null }
    >;
    capacityDistribution: { bucket: string; classes: number }[];
    capacityExcluded: number;
    enrollmentsDepartmentId: number | null;
    enrollmentsTrend: { month: string; count: number }[];
    enrollmentsTotal12mo: number;
    enrollmentsDeltaPct: number | null;
    recentActivity: { id: string; type: "enrollment" | "class" | "user"; actor: string; message: string; at: string }[];
};

// Every CTE here is scoped to the caller's own workspace via workspaceId - a
// visitor's dashboard must only ever reflect their own sandboxed data, never
// another workspace's. `user` itself stays unscoped (it's shared/global
// identity, not workspace data) - "students"/"faculty" are counted as
// distinct people enrolled in / teaching this workspace's classes, not as
// raw `user` row counts, since fixture identities are reused across every
// workspace and were never "created" per-workspace to begin with.
//
// KPI semantics (see FINDINGS.md): every `value` below is a genuine total -
// count(*) / count(distinct ...) with no date filter - and `previous` is the
// same total as it stood at the start of the current calendar month, so the
// card's delta is real growth on a real total. This replaced a version where
// `value` silently meant "rows created this month", which matched neither
// the "Total X" label nor the capacity chart's own total for the same table.
// `classes_total` here and the capacity distribution below both scan the
// same `classes` rows with the same workspace filter and no other condition,
// so the two numbers can't structurally drift apart - enforced by
// scripts/verify-kpi-capacity-parity.ts.
const runSummaryQuery = async (tz: string, departmentId: number | null, allDepartments: boolean, workspaceId: string) => {
    const result = await db.execute<{ result: DashboardSummary }>(sql`
        WITH bounds AS (
            SELECT
                (date_trunc('month', now() AT TIME ZONE ${tz}) AT TIME ZONE ${tz} AT TIME ZONE 'UTC') AS cur_start
        ),
        student_counts AS (
            SELECT
                count(DISTINCT student_id) AS students_total,
                count(DISTINCT student_id) FILTER (WHERE created_at < b.cur_start) AS students_previous
            FROM enrollments, bounds b
            WHERE workspace_id = ${workspaceId}
        ),
        faculty_counts AS (
            SELECT
                count(DISTINCT teacher_id) AS faculty_total,
                count(DISTINCT teacher_id) FILTER (WHERE created_at < b.cur_start) AS faculty_previous
            FROM classes, bounds b
            WHERE workspace_id = ${workspaceId}
        ),
        class_counts AS (
            SELECT
                count(*) AS classes_total,
                count(*) FILTER (WHERE created_at < b.cur_start) AS classes_previous
            FROM classes, bounds b
            WHERE workspace_id = ${workspaceId}
        ),
        subject_counts AS (
            SELECT
                count(*) AS subjects_total,
                count(*) FILTER (WHERE created_at < b.cur_start) AS subjects_previous
            FROM subjects, bounds b
            WHERE workspace_id = ${workspaceId}
        ),
        class_ratios AS (
            SELECT c.id, c.capacity, count(e.id) FILTER (WHERE e.status = 'active') AS enrolled
            FROM classes c
            LEFT JOIN enrollments e ON e.class_id = c.id
            WHERE c.workspace_id = ${workspaceId}
            GROUP BY c.id, c.capacity
        ),
        bucket_defs (bucket, sort_order) AS (
            VALUES ('81-100', 1), ('61-80', 2), ('41-60', 3), ('21-40', 4), ('0-20', 5)
        ),
        capacity_bucketed AS (
            SELECT
                CASE
                    WHEN capacity <= 0 THEN NULL
                    WHEN enrolled::numeric / capacity > 0.80 THEN '81-100'
                    WHEN enrolled::numeric / capacity > 0.60 THEN '61-80'
                    WHEN enrolled::numeric / capacity > 0.40 THEN '41-60'
                    WHEN enrolled::numeric / capacity > 0.20 THEN '21-40'
                    ELSE '0-20'
                END AS bucket
            FROM class_ratios
        ),
        capacity_counts AS (
            SELECT bd.bucket, bd.sort_order, count(cb.bucket) AS cnt
            FROM bucket_defs bd
            LEFT JOIN capacity_bucketed cb ON cb.bucket = bd.bucket
            GROUP BY bd.bucket, bd.sort_order
        ),
        capacity_excluded AS (
            SELECT count(*) AS cnt FROM capacity_bucketed WHERE bucket IS NULL
        ),
        months AS (
            SELECT generate_series(
                date_trunc('month', now() AT TIME ZONE ${tz}) - interval '11 months',
                date_trunc('month', now() AT TIME ZONE ${tz}),
                interval '1 month'
            ) AS month_start
        ),
        target_department AS (
            SELECT COALESCE(
                ${departmentId}::integer,
                (
                    SELECT s.department_id
                    FROM classes c2
                    JOIN subjects s ON s.id = c2.subject_id
                    WHERE c2.workspace_id = ${workspaceId}
                    GROUP BY s.department_id
                    ORDER BY count(*) DESC
                    LIMIT 1
                )
            ) AS department_id
        ),
        -- Per-month enrolment counts, not a cumulative running total - this is
        -- what replaced the old "average fill rate" trend (see FINDINGS.md /
        -- Part D of the brief): that chart computed enrolments-to-date over
        -- capacity, which by construction can only ever climb. A plain count
        -- of enrolments created within each calendar month actually varies
        -- month to month and answers "when do people join classes", which is
        -- the question this product's own data can answer.
        enrollments_trend AS (
            SELECT
                to_char(m.month_start, 'YYYY-MM') AS month,
                count(e.id) FILTER (WHERE ${allDepartments} OR s.department_id = td.department_id) AS cnt
            FROM months m
            CROSS JOIN target_department td
            LEFT JOIN enrollments e ON e.workspace_id = ${workspaceId}
                AND date_trunc('month', (e.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz})) = m.month_start
            LEFT JOIN classes c ON c.id = e.class_id
            LEFT JOIN subjects s ON s.id = c.subject_id
            GROUP BY m.month_start
        ),
        enrollments_12mo AS (
            SELECT count(e.id) AS n
            FROM enrollments e
            LEFT JOIN classes c ON c.id = e.class_id
            LEFT JOIN subjects s ON s.id = c.subject_id
            CROSS JOIN target_department td
            WHERE e.workspace_id = ${workspaceId}
                AND e.created_at >= now() - interval '12 months'
                AND (${allDepartments} OR s.department_id = td.department_id)
        ),
        enrollments_prior_12mo AS (
            SELECT count(e.id) AS n
            FROM enrollments e
            LEFT JOIN classes c ON c.id = e.class_id
            LEFT JOIN subjects s ON s.id = c.subject_id
            CROSS JOIN target_department td
            WHERE e.workspace_id = ${workspaceId}
                AND e.created_at >= now() - interval '24 months'
                AND e.created_at < now() - interval '12 months'
                AND (${allDepartments} OR s.department_id = td.department_id)
        ),
        recent_activity AS (
            (
                SELECT
                    'enrollment-' || e.id AS id,
                    'enrollment' AS type,
                    COALESCE(stu.name, 'A student') AS actor,
                    COALESCE(stu.name, 'A student') || ' enrolled in ' || COALESCE(cl.name, 'a class') AS message,
                    e.created_at AS at
                FROM enrollments e
                LEFT JOIN "user" stu ON stu.id = e.student_id
                LEFT JOIN classes cl ON cl.id = e.class_id
                WHERE e.workspace_id = ${workspaceId}
                ORDER BY e.created_at DESC
                LIMIT 10
            )
            UNION ALL
            (
                SELECT
                    'class-' || c.id AS id,
                    'class' AS type,
                    COALESCE(t.name, 'Someone') AS actor,
                    'New class "' || c.name || '" was created' AS message,
                    c.created_at AS at
                FROM classes c
                LEFT JOIN "user" t ON t.id = c.teacher_id
                WHERE c.workspace_id = ${workspaceId}
                ORDER BY c.created_at DESC
                LIMIT 10
            )
        )
        SELECT json_build_object(
            'kpis', json_build_object(
                'students', json_build_object(
                    'value', sc2.students_total, 'previous', sc2.students_previous,
                    'deltaPct', CASE WHEN sc2.students_previous > 0
                        THEN round(((sc2.students_total - sc2.students_previous)::numeric / sc2.students_previous) * 100, 1) END
                ),
                'faculty', json_build_object(
                    'value', fc.faculty_total, 'previous', fc.faculty_previous,
                    'deltaPct', CASE WHEN fc.faculty_previous > 0
                        THEN round(((fc.faculty_total - fc.faculty_previous)::numeric / fc.faculty_previous) * 100, 1) END
                ),
                'classes', json_build_object(
                    'value', clc.classes_total, 'previous', clc.classes_previous,
                    'deltaPct', CASE WHEN clc.classes_previous > 0
                        THEN round(((clc.classes_total - clc.classes_previous)::numeric / clc.classes_previous) * 100, 1) END
                ),
                'subjects', json_build_object(
                    'value', suc.subjects_total, 'previous', suc.subjects_previous,
                    'deltaPct', CASE WHEN suc.subjects_previous > 0
                        THEN round(((suc.subjects_total - suc.subjects_previous)::numeric / suc.subjects_previous) * 100, 1) END
                )
            ),
            'capacityDistribution', (
                SELECT jsonb_agg(json_build_object('bucket', bucket, 'classes', cnt) ORDER BY sort_order)
                FROM capacity_counts
            ),
            'capacityExcluded', (SELECT cnt FROM capacity_excluded),
            'enrollmentsDepartmentId', (SELECT department_id FROM target_department),
            'enrollmentsTrend', (
                SELECT jsonb_agg(json_build_object('month', month, 'count', cnt) ORDER BY month)
                FROM enrollments_trend
            ),
            'enrollmentsTotal12mo', (SELECT n FROM enrollments_12mo),
            'enrollmentsDeltaPct', (
                SELECT CASE WHEN p.n > 0 THEN round(((c12.n - p.n)::numeric / p.n) * 100, 1) END
                FROM enrollments_12mo c12, enrollments_prior_12mo p
            ),
            'recentActivity', (
                SELECT jsonb_agg(json_build_object('id', id, 'type', type, 'actor', actor, 'message', message, 'at', at) ORDER BY at DESC)
                FROM (SELECT * FROM recent_activity ORDER BY at DESC LIMIT 10) ra
            )
        ) AS result
        FROM student_counts sc2, faculty_counts fc, class_counts clc, subject_counts suc;
    `);

    return result.rows[0]?.result;
};

router.get("/summary", requireAuth, workspaceMiddleware, dashboardRateLimit, async (req, res) => {
    try {
        const tzParam = req.query.tz;
        const tz = isPlausibleTimeZone(tzParam) ? tzParam : "UTC";

        const allDepartments = req.query.department === "all";
        const departmentParam = Number(req.query.department);
        const departmentId = !allDepartments && Number.isFinite(departmentParam) && departmentParam > 0 ? departmentParam : null;

        let summary: DashboardSummary | undefined;
        try {
            summary = await runSummaryQuery(tz, departmentId, allDepartments, req.workspaceId!);
        } catch (e) {
            // Most likely an invalid IANA zone name from the client — retry once
            // against UTC rather than failing the whole page.
            console.error(`GET /dashboard/summary query failed for tz="${tz}", retrying with UTC: ${e}`);
            summary = await runSummaryQuery("UTC", departmentId, allDepartments, req.workspaceId!);
        }

        if (!summary) throw new Error("Summary query returned no row");

        // Was "private, max-age=30, stale-while-revalidate=120" - but this
        // response is scoped to whichever workspace req.workspaceId! resolved
        // to for the CURRENT session, and nothing here varies the cache key
        // by session/cookie (no Vary header, and the URL itself is identical
        // for every visitor: /dashboard/summary?tz=...). A browser's HTTP
        // cache keys purely on method+URL, so signing out and back in as a
        // different account in the same browser tab could - and did - get
        // served the PREVIOUS account's cached response for up to 150s
        // (max-age + stale-while-revalidate), showing stale KPIs that have
        // nothing to do with the new session's actual workspace. This data
        // is cheap enough to recompute (see the parity/perf notes above)
        // that "never cache it client-side" is the safe default here.
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).json({ data: summary });
    } catch (e) {
        console.error(`GET /dashboard/summary error: ${e}`);
        res.status(500).json({ error: "Failed to load dashboard summary" });
    }
});

export default router;
