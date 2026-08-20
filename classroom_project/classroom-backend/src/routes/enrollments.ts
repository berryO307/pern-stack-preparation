import express from "express";
import { db } from "../db/index.js";
import { classes, enrollments, user } from "../db/schema/index.js";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";

const router = express.Router();

const pgErrorCode = (e: any): string | undefined => e?.code ?? e?.cause?.code;

// Get all enrollments for a class, with student info
router.get("/", async (req, res) => {
    try {
        const { classId, studentId } = req.query;

        const filterConditions = [];
        if (classId) filterConditions.push(eq(enrollments.classId, Number(classId)));
        if (studentId) filterConditions.push(eq(enrollments.studentId, String(studentId)));

        if (filterConditions.length === 0) {
            return res.status(400).json({ error: "classId or studentId is required" });
        }

        const whereClause = and(...filterConditions);

        const enrollmentsList = await db
            .select({
                ...getTableColumns(enrollments),
                student: { ...getTableColumns(user) },
            })
            .from(enrollments)
            .leftJoin(user, eq(enrollments.studentId, user.id))
            .where(whereClause)
            .orderBy(desc(enrollments.createdAt));

        res.status(200).json({
            data: enrollmentsList,
            pagination: {
                page: 1,
                limit: enrollmentsList.length,
                total: enrollmentsList.length,
                totalPages: 1,
            },
        });
    } catch (e) {
        console.error(`GET /enrollments error: ${e}`);
        res.status(500).json({ error: "Failed to load enrollments" });
    }
});

router.post("/", async (req, res) => {
    try {
        const { classId, studentId } = req.body;

        if (!classId || !studentId) {
            return res.status(400).json({ error: "classId and studentId are required" });
        }

        const [targetClass] = await db
            .select({ id: classes.id, capacity: classes.capacity })
            .from(classes)
            .where(eq(classes.id, Number(classId)));

        if (!targetClass) return res.status(404).json({ error: "No class found" });

        const enrolledCountResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(enrollments)
            .where(eq(enrollments.classId, targetClass.id));

        if (Number(enrolledCountResult[0]?.count ?? 0) >= targetClass.capacity) {
            return res.status(409).json({ error: "This class is at full capacity" });
        }

        const [createdEnrollment] = await db
            .insert(enrollments)
            .values({ classId: targetClass.id, studentId })
            .returning();

        res.status(201).json({ data: createdEnrollment });
    } catch (e: any) {
        if (pgErrorCode(e) === "23505") {
            return res.status(409).json({ error: "This student is already enrolled in this class" });
        }
        console.error(`POST /enrollments error: ${e}`);
        res.status(500).json({ error: "Failed to enroll student" });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const enrollmentId = Number(req.params.id);
        if (!Number.isFinite(enrollmentId)) return res.status(404).json({ error: "No enrollment found" });

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
