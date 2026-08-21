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
    fillRateDepartmentId: number | null;
    fillRateTrend: { month: string; selected: number | null; institution: number | null }[];
    recentActivity: { id: string; type: "enrollment" | "class" | "user"; actor: string; message: string; at: string }[];
};

// Every CTE here is scoped to the caller's own workspace via workspaceId - a
// visitor's dashboard must only ever reflect their own sandboxed data, never
// another workspace's. `user` itself stays unscoped (it's shared/global
// identity, not workspace data) - "students"/"faculty" are counted as
// distinct people enrolled in / teaching this workspace's classes, not as
// raw `user` row counts, since fixture identities are reused across every
// workspace and were never "created" per-workspace to begin with.
const runSummaryQuery = async (tz: string, departmentId: number | null, workspaceId: string) => {
    const result = await db.execute<{ result: DashboardSummary }>(sql`
        WITH bounds AS (
            SELECT
                (date_trunc('month', now() AT TIME ZONE ${tz}) AT TIME ZONE ${tz} AT TIME ZONE 'UTC') AS cur_start,
                (now() AT TIME ZONE 'UTC') AS cur_end,
                (
                    (date_trunc('month', now() AT TIME ZONE ${tz}) - interval '1 month')
                    AT TIME ZONE ${tz} AT TIME ZONE 'UTC'
                ) AS prev_start,
                (
                    (
                        (date_trunc('month', now() AT TIME ZONE ${tz}) - interval '1 month')
                        + ((now() AT TIME ZONE ${tz}) - date_trunc('month', now() AT TIME ZONE ${tz}))
                    ) AT TIME ZONE ${tz} AT TIME ZONE 'UTC'
                ) AS prev_end
        ),
        student_counts AS (
            SELECT
                count(DISTINCT student_id) FILTER (WHERE created_at >= b.cur_start AND created_at < b.cur_end) AS students_current,
                count(DISTINCT student_id) FILTER (WHERE created_at >= b.prev_start AND created_at < b.prev_end) AS students_previous
            FROM enrollments, bounds b
            WHERE workspace_id = ${workspaceId}
        ),
        faculty_counts AS (
            SELECT
                count(DISTINCT teacher_id) FILTER (WHERE created_at >= b.cur_start AND created_at < b.cur_end) AS faculty_current,
                count(DISTINCT teacher_id) FILTER (WHERE created_at >= b.prev_start AND created_at < b.prev_end) AS faculty_previous
            FROM classes, bounds b
            WHERE workspace_id = ${workspaceId}
        ),
        class_counts AS (
            SELECT
                count(*) FILTER (WHERE created_at >= b.cur_start AND created_at < b.cur_end) AS classes_current,
                count(*) FILTER (WHERE created_at >= b.prev_start AND created_at < b.prev_end) AS classes_previous
            FROM classes, bounds b
            WHERE workspace_id = ${workspaceId}
        ),
        subject_counts AS (
            SELECT
                count(*) FILTER (WHERE created_at >= b.cur_start AND created_at < b.cur_end) AS subjects_current,
                count(*) FILTER (WHERE created_at >= b.prev_start AND created_at < b.prev_end) AS subjects_previous
            FROM subjects, bounds b
            WHERE workspace_id = ${workspaceId}
        ),
        class_ratios AS (
            SELECT c.id, c.capacity, count(e.id) AS enrolled
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
        fill_rate_trend AS (
            SELECT
                to_char(m.month_start, 'YYYY-MM') AS month,
                avg(CASE WHEN c.capacity > 0 THEN LEAST(cnt.n::numeric / c.capacity, 1) * 100 END)
                    FILTER (WHERE s.department_id = td.department_id) AS selected_pct,
                avg(CASE WHEN c.capacity > 0 THEN LEAST(cnt.n::numeric / c.capacity, 1) * 100 END) AS institution_pct
            FROM months m
            CROSS JOIN target_department td
            LEFT JOIN classes c ON c.workspace_id = ${workspaceId}
                AND (c.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) < (m.month_start + interval '1 month')
            LEFT JOIN subjects s ON s.id = c.subject_id
            LEFT JOIN LATERAL (
                SELECT count(*) AS n
                FROM enrollments e
                WHERE e.class_id = c.id
                    AND e.workspace_id = ${workspaceId}
                    AND (e.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) < (m.month_start + interval '1 month')
            ) cnt ON true
            GROUP BY m.month_start
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
                    'value', sc2.students_current, 'previous', sc2.students_previous,
                    'deltaPct', CASE WHEN sc2.students_previous > 0
                        THEN round(((sc2.students_current - sc2.students_previous)::numeric / sc2.students_previous) * 100, 1) END
                ),
                'faculty', json_build_object(
                    'value', fc.faculty_current, 'previous', fc.faculty_previous,
                    'deltaPct', CASE WHEN fc.faculty_previous > 0
                        THEN round(((fc.faculty_current - fc.faculty_previous)::numeric / fc.faculty_previous) * 100, 1) END
                ),
                'classes', json_build_object(
                    'value', clc.classes_current, 'previous', clc.classes_previous,
                    'deltaPct', CASE WHEN clc.classes_previous > 0
                        THEN round(((clc.classes_current - clc.classes_previous)::numeric / clc.classes_previous) * 100, 1) END
                ),
                'subjects', json_build_object(
                    'value', suc.subjects_current, 'previous', suc.subjects_previous,
                    'deltaPct', CASE WHEN suc.subjects_previous > 0
                        THEN round(((suc.subjects_current - suc.subjects_previous)::numeric / suc.subjects_previous) * 100, 1) END
                )
            ),
            'capacityDistribution', (
                SELECT jsonb_agg(json_build_object('bucket', bucket, 'classes', cnt) ORDER BY sort_order)
                FROM capacity_counts
            ),
            'capacityExcluded', (SELECT cnt FROM capacity_excluded),
            'fillRateDepartmentId', (SELECT department_id FROM target_department),
            'fillRateTrend', (
                SELECT jsonb_agg(
                    json_build_object('month', month, 'selected', round(selected_pct, 1), 'institution', round(institution_pct, 1))
                    ORDER BY month
                )
                FROM fill_rate_trend
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

        const departmentParam = Number(req.query.department);
        const departmentId = Number.isFinite(departmentParam) && departmentParam > 0 ? departmentParam : null;

        let summary: DashboardSummary | undefined;
        try {
            summary = await runSummaryQuery(tz, departmentId, req.workspaceId!);
        } catch (e) {
            // Most likely an invalid IANA zone name from the client — retry once
            // against UTC rather than failing the whole page.
            console.error(`GET /dashboard/summary query failed for tz="${tz}", retrying with UTC: ${e}`);
            summary = await runSummaryQuery("UTC", departmentId, req.workspaceId!);
        }

        if (!summary) throw new Error("Summary query returned no row");

        res.setHeader("Cache-Control", "private, max-age=30, stale-while-revalidate=120");
        res.status(200).json({ data: summary });
    } catch (e) {
        console.error(`GET /dashboard/summary error: ${e}`);
        res.status(500).json({ error: "Failed to load dashboard summary" });
    }
});

export default router;
