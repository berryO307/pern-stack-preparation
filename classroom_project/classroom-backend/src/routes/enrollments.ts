import express from "express";
import { db } from "../db/index.js";
import { classes, enrollments, subjects, user } from "../db/schema/index.js";
import { and, asc, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { enforceWriteQuota, incrementWriteCount, requireAuth } from "../middleware/authorize.js";

const router = express.Router();

const pgErrorCode = (e: any): string | undefined => e?.code ?? e?.cause?.code;

const SORTABLE_ENROLLMENT_FIELDS = {
    createdAt: enrollments.createdAt,
    student: user.name,
    class: classes.name,
} as const;

// Get enrollments, with optional classId/studentId filters, search, sorting and pagination.
// classId/studentId narrow the result set (used by the class roster and student profile
// views); omitting both returns the full, paginated list for the Enrollments page.
router.get("/", async (req, res) => {
    try {
        const { classId, studentId, search, page = 1, limit = 10, sortField, sortOrder } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const sortColumn = SORTABLE_ENROLLMENT_FIELDS[String(sortField) as keyof typeof SORTABLE_ENROLLMENT_FIELDS];
        const orderByClause = sortColumn
            ? (sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn))
            : desc(enrollments.createdAt);

        if (classId !== undefined && !Number.isFinite(Number(classId))) {
            return res.status(400).json({ error: "Invalid classId" });
        }

        const filterConditions = [];
        if (classId) filterConditions.push(eq(enrollments.classId, Number(classId)));
        if (studentId) filterConditions.push(eq(enrollments.studentId, String(studentId)));
        if (search) {
            filterConditions.push(
                or(
                    ilike(user.name, `%${search}%`),
                    ilike(user.email, `%${search}%`),
                    ilike(classes.name, `%${search}%`),
                )
            );
        }
        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResults = await db
            .select({ count: sql<number>`count(*)` })
            .from(enrollments)
            .leftJoin(user, eq(enrollments.studentId, user.id))
            .leftJoin(classes, eq(enrollments.classId, classes.id))
            .where(whereClause);

        const totalCount = countResults[0]?.count ?? 0;

        const rows = await db
            .select({
                ...getTableColumns(enrollments),
                student: { ...getTableColumns(user) },
                class: { ...getTableColumns(classes) },
                subject: { ...getTableColumns(subjects) },
            })
            .from(enrollments)
            .leftJoin(user, eq(enrollments.studentId, user.id))
            .leftJoin(classes, eq(enrollments.classId, classes.id))
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
            .where(whereClause)
            .orderBy(orderByClause)
            .limit(limitPerPage)
            .offset(offset);

        const enrollmentsList = rows.map(({ class: classRow, subject, ...rest }) => ({
            ...rest,
            class: classRow ? { ...classRow, subject } : null,
        }));

        res.status(200).json({
            data: enrollmentsList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            },
        });
    } catch (e) {
        console.error(`GET /enrollments error: ${e}`);
        res.status(500).json({ error: "Failed to load enrollments" });
    }
});

router.post("/", requireAuth, enforceWriteQuota, async (req, res) => {
    try {
        const { classId: rawClassId, studentId } = req.body;
        const classId = Number(rawClassId);

        if (!Number.isFinite(classId) || classId <= 0 || !studentId) {
            return res.status(400).json({ error: "classId and studentId are required" });
        }

        const [targetClass] = await db
            .select({ id: classes.id })
            .from(classes)
            .where(eq(classes.id, classId));

        if (!targetClass) return res.status(404).json({ error: "No class found" });

        // Neon's HTTP driver has no interactive transactions (a session can't hold
        // a lock across separate round trips), but `db.batch` sends a fixed list
        // of queries as one atomic Postgres transaction. Locking the class row
        // with FOR UPDATE first means a concurrent enrollment on the same class
        // blocks until this one commits, so the capacity check the INSERT's WHERE
        // clause does can't race against another request's insert.
        const [, insertResult] = await db.batch([
            db.execute(sql`SELECT capacity FROM ${classes} WHERE ${classes.id} = ${classId} FOR UPDATE`),
            db.execute(sql`
                INSERT INTO ${enrollments} (class_id, student_id, created_by)
                SELECT ${classId}, ${studentId}, ${req.user!.id}
                WHERE (SELECT count(*) FROM ${enrollments} WHERE class_id = ${classId})
                    < (SELECT capacity FROM ${classes} WHERE id = ${classId})
                RETURNING *
            `),
        ]);

        const createdEnrollment = (insertResult as unknown as { rows: (typeof enrollments.$inferSelect)[] }).rows[0];

        if (!createdEnrollment) {
            return res.status(409).json({ error: "This class is at full capacity" });
        }

        await incrementWriteCount(req.user!.id);

        res.status(201).json({ data: createdEnrollment });
    } catch (e: any) {
        if (pgErrorCode(e) === "23505") {
            return res.status(409).json({ error: "This student is already enrolled in this class" });
        }
        console.error(`POST /enrollments error: ${e}`);
        res.status(500).json({ error: "Failed to enroll student" });
    }
});

router.delete("/:id", requireAuth, async (req, res) => {
    try {
        const enrollmentId = Number(req.params.id);
        if (!Number.isFinite(enrollmentId)) return res.status(404).json({ error: "No enrollment found" });

        const [existingEnrollment] = await db
            .select({ createdBy: enrollments.createdBy })
            .from(enrollments)
            .where(eq(enrollments.id, enrollmentId));

        if (!existingEnrollment) return res.status(404).json({ error: "No enrollment found" });

        if (req.user!.role !== "admin" && existingEnrollment.createdBy !== req.user!.id) {
            return res.status(403).json({ error: "You can only unenroll students you enrolled yourself" });
        }

        const [deletedEnrollment] = await db
            .delete(enrollments)
            .where(eq(enrollments.id, enrollmentId))
            .returning({ id: enrollments.id });

        if (!deletedEnrollment) return res.status(404).json({ error: "No enrollment found" });

        res.status(200).json({ data: deletedEnrollment });
    } catch (e) {
        console.error(`DELETE /enrollments/:id error: ${e}`);
        res.status(500).json({ error: "Failed to unenroll student" });
    }
});

export default router;
