import express from "express";
import { db } from "../db/index.js";
import { classes, departments, enrollments, subjects, user } from "../db/schema/index.js";
import { desc, eq, gte, sql } from "drizzle-orm";

const router = express.Router();

const countRows = async (query: Promise<{ count: number }[]>) => {
    const [row] = await query;
    return Number(row?.count ?? 0);
};

router.get("/", async (req, res) => {
    try {
        const [
            totalStudents,
            totalTeachers,
            totalAdmins,
            totalDepartments,
            totalSubjects,
            totalClasses,
            activeClasses,
            totalEnrollments,
            capacityResult,
        ] = await Promise.all([
            countRows(db.select({ count: sql<number>`count(*)` }).from(user).where(eq(user.role, "student"))),
            countRows(db.select({ count: sql<number>`count(*)` }).from(user).where(eq(user.role, "teacher"))),
            countRows(db.select({ count: sql<number>`count(*)` }).from(user).where(eq(user.role, "admin"))),
            countRows(db.select({ count: sql<number>`count(*)` }).from(departments)),
            countRows(db.select({ count: sql<number>`count(*)` }).from(subjects)),
            countRows(db.select({ count: sql<number>`count(*)` }).from(classes)),
            countRows(db.select({ count: sql<number>`count(*)` }).from(classes).where(eq(classes.status, "active"))),
            countRows(db.select({ count: sql<number>`count(*)` }).from(enrollments)),
            db.select({ totalCapacity: sql<number>`coalesce(sum(${classes.capacity}), 0)` }).from(classes),
        ]);

        const totalCapacity = Number(capacityResult[0]?.totalCapacity ?? 0);
        const capacityUtilization = totalCapacity > 0
            ? Math.round((totalEnrollments / totalCapacity) * 100)
            : 0;

        // Enrollment trend for the last 14 days (including days with zero enrollments)
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
        fourteenDaysAgo.setHours(0, 0, 0, 0);

        const enrollmentRows = await db
            .select({
                day: sql<string>`to_char(date_trunc('day', ${enrollments.createdAt}), 'YYYY-MM-DD')`,
                count: sql<number>`count(*)`,
            })
            .from(enrollments)
            .where(gte(enrollments.createdAt, fourteenDaysAgo))
            .groupBy(sql`date_trunc('day', ${enrollments.createdAt})`)
            .orderBy(sql`date_trunc('day', ${enrollments.createdAt})`);

        const enrollmentByDay = new Map(enrollmentRows.map((row) => [row.day, Number(row.count)]));
        const enrollmentTrends = Array.from({ length: 14 }, (_, i) => {
            const date = new Date(fourteenDaysAgo);
            date.setDate(date.getDate() + i);
            const key = date.toISOString().slice(0, 10);
            return { date: key, count: enrollmentByDay.get(key) ?? 0 };
        });

        // Classes grouped by department (departments with no classes still show as 0)
        const classesByDepartment = await db
            .select({
                department: departments.name,
                count: sql<number>`count(${classes.id})`,
            })
            .from(departments)
            .leftJoin(subjects, eq(subjects.departmentId, departments.id))
            .leftJoin(classes, eq(classes.subjectId, subjects.id))
            .groupBy(departments.id, departments.name)
            .orderBy(departments.name);

        // Capacity status buckets, derived from each class's enrolled/capacity ratio
        const classCapacities = await db
            .select({
                capacity: classes.capacity,
                enrolled: sql<number>`count(${enrollments.id})`,
            })
            .from(classes)
            .leftJoin(enrollments, eq(enrollments.classId, classes.id))
            .groupBy(classes.id, classes.capacity);

        const capacityBuckets = { low: 0, medium: 0, high: 0, full: 0 };
        for (const { capacity, enrolled } of classCapacities) {
            const ratio = capacity > 0 ? Number(enrolled) / capacity : 0;
            if (ratio >= 1) capacityBuckets.full += 1;
            else if (ratio >= 0.8) capacityBuckets.high += 1;
            else if (ratio >= 0.5) capacityBuckets.medium += 1;
            else capacityBuckets.low += 1;
        }
        const capacityStatus = [
            { status: "low", label: "Under 50%", count: capacityBuckets.low },
            { status: "medium", label: "50-79%", count: capacityBuckets.medium },
            { status: "high", label: "80-99%", count: capacityBuckets.high },
            { status: "full", label: "Full", count: capacityBuckets.full },
        ];

        const userDistribution = [
            { role: "student", count: totalStudents },
            { role: "teacher", count: totalTeachers },
            { role: "admin", count: totalAdmins },
        ];

        // Recent activity feed, merged from the three most-recently-touched tables
        const [recentEnrollments, recentClasses, recentUsers] = await Promise.all([
            db
                .select({
                    id: enrollments.id,
                    createdAt: enrollments.createdAt,
                    studentName: user.name,
                    className: classes.name,
                })
                .from(enrollments)
                .leftJoin(user, eq(enrollments.studentId, user.id))
                .leftJoin(classes, eq(enrollments.classId, classes.id))
                .orderBy(desc(enrollments.createdAt))
                .limit(5),
            db
                .select({ id: classes.id, createdAt: classes.createdAt, name: classes.name })
                .from(classes)
                .orderBy(desc(classes.createdAt))
                .limit(5),
            db
                .select({ id: user.id, createdAt: user.createdAt, name: user.name, role: user.role })
                .from(user)
                .orderBy(desc(user.createdAt))
                .limit(5),
        ]);

        const activity = [
            ...recentEnrollments.map((e) => ({
                type: "enrollment" as const,
                message: `${e.studentName ?? "A student"} enrolled in ${e.className ?? "a class"}`,
                timestamp: e.createdAt,
            })),
            ...recentClasses.map((c) => ({
                type: "class" as const,
                message: `New class "${c.name}" was created`,
                timestamp: c.createdAt,
            })),
            ...recentUsers.map((u) => ({
                type: "user" as const,
                message: `${u.name} joined as ${u.role}`,
                timestamp: u.createdAt,
            })),
        ]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 10);

        res.status(200).json({
            data: {
                metrics: {
                    totalStudents,
                    totalTeachers,
                    totalAdmins,
                    totalUsers: totalStudents + totalTeachers + totalAdmins,
                    totalDepartments,
                    totalSubjects,
                    totalClasses,
                    activeClasses,
                    totalEnrollments,
                    totalCapacity,
                    capacityUtilization,
                },
                enrollmentTrends,
                classesByDepartment,
                capacityStatus,
                userDistribution,
                activity,
            },
        });
    } catch (e) {
        console.error(`GET /dashboard error: ${e}`);
        res.status(500).json({ error: "Failed to load dashboard data" });
    }
});

export default router;
