import express from "express";
import {classes, departments, enrollments, subjects, user} from "../db/schema/index.js";
import {and, desc, eq, getTableColumns, ilike, ne, or, sql} from "drizzle-orm";
import {db} from "../db/index.js";
import {requireAuth} from "../middleware/authorize.js";
import workspaceMiddleware from "../middleware/workspace.js";
import {enforceRowQuota} from "../middleware/rowQuota.js";
import domainWriteRateLimit from "../middleware/domainWriteRateLimit.js";
const router = express.Router();

const pgErrorCode = (e: any): string | undefined => e?.code ?? e?.cause?.code;

// Escapes ILIKE wildcard/escape characters so a literal search for e.g. "50%"
// or "a_b" doesn't get interpreted as a wildcard pattern.
const escapeLike = (value: string) => value.replace(/[%_\\]/g, "\\$&");

router.use(requireAuth, workspaceMiddleware);

// Get all subjects switch optional search, filtering and pagination
router.get("/", async (req, res) => {
    try {
        const { search, department, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;
        const filterConditions = [eq(subjects.workspaceId, req.workspaceId!)];
        // If search query exists, filter by subject name OR subject code
        if (search) {
            const searchPattern = `%${escapeLike(String(search))}%`;
            filterConditions.push(
                or(
                    ilike(subjects.name, searchPattern),
                    ilike(subjects.code, searchPattern),
                )!
            );
        }
        // If department filter exists, match department name
        if (department) {
            const deptPattern = `%${String(department).replace(/[%_]/g, '\\$&')}%`;
            filterConditions.push(ilike(departments.name, deptPattern));
        }
        const whereClause = and(...filterConditions);
        const countResults = await db
            .select({ count: sql<number>`count(*)` })
            .from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause);

        const totalCount = countResults[0] ?.count ?? 0;
        const subjectsList = await db.select({
            ...getTableColumns(subjects),
            department: { ...getTableColumns(departments)}
        }).from(subjects).leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause)
            .orderBy(desc(subjects.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: subjectsList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }
        })

    }catch (e) {
        console.error(`GET /subjects error: ${e}`);
        res.status(500).json({ error: 'Failed to load subjects' });
    }
})

// Get a single subject with its department
router.get("/:id", async (req, res) => {
    try {
        const subjectId = Number(req.params.id);
        if (!Number.isFinite(subjectId)) return res.status(404).json({ error: "No subject found" });

        const [subject] = await db
            .select({
                ...getTableColumns(subjects),
                department: { ...getTableColumns(departments) },
            })
            .from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(and(eq(subjects.id, subjectId), eq(subjects.workspaceId, req.workspaceId!)));

        if (!subject) return res.status(404).json({ error: "No subject found" });

        // Deduped via SELECT DISTINCT on the person columns alone - a teacher
        // running three sections, or a student in two of them, still
        // produces identical rows for those columns, so DISTINCT collapses
        // them without needing a separate GROUP BY/window step.
        const teachers = await db
            .selectDistinct({
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                imageCldPubId: user.imageCldPubId,
            })
            .from(classes)
            .innerJoin(user, eq(classes.teacherId, user.id))
            .where(and(eq(classes.subjectId, subjectId), eq(classes.workspaceId, req.workspaceId!)));

        const students = await db
            .selectDistinct({
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                imageCldPubId: user.imageCldPubId,
            })
            .from(enrollments)
            .innerJoin(classes, eq(enrollments.classId, classes.id))
            .innerJoin(user, eq(enrollments.studentId, user.id))
            .where(and(
                eq(classes.subjectId, subjectId),
                eq(enrollments.status, "active"),
                eq(enrollments.workspaceId, req.workspaceId!),
            ));

        res.status(200).json({ data: { ...subject, teachers, students } });
    } catch (e) {
        console.error(`GET /subjects/:id error: ${e}`);
        res.status(500).json({ error: "Failed to load subject" });
    }
});

router.post("/", domainWriteRateLimit, enforceRowQuota(subjects, subjects.workspaceId, "subject"), async (req, res) => {
    try {
        const { name, code, description, departmentId, imageCldPubId } = req.body;

        if (!name || !code || !departmentId) {
            return res.status(400).json({ error: "Name, code and department are required" });
        }

        const [department] = await db
            .select({ id: departments.id })
            .from(departments)
            .where(and(eq(departments.id, Number(departmentId)), eq(departments.workspaceId, req.workspaceId!)));

        if (!department) return res.status(409).json({ error: "No department found with that id" });

        const [createdSubject] = await db
            .insert(subjects)
            .values({ name, code, description, imageCldPubId, departmentId: Number(departmentId), workspaceId: req.workspaceId! })
            .returning();

        res.status(201).json({ data: createdSubject });
    } catch (e: any) {
        if (pgErrorCode(e) === "23505") {
            return res.status(409).json({ error: "A subject with this code already exists" });
        }
        if (pgErrorCode(e) === "23503") {
            return res.status(409).json({ error: "No department found with that id" });
        }
        console.error(`POST /subjects error: ${e}`);
        res.status(500).json({ error: "Failed to create subject" });
    }
});

router.put("/:id", domainWriteRateLimit, async (req, res) => {
    try {
        const subjectId = Number(req.params.id);
        if (!Number.isFinite(subjectId)) return res.status(404).json({ error: "No subject found" });

        const { name, code, description, departmentId, imageCldPubId } = req.body;

        if (departmentId !== undefined) {
            const [department] = await db
                .select({ id: departments.id })
                .from(departments)
                .where(and(eq(departments.id, Number(departmentId)), eq(departments.workspaceId, req.workspaceId!)));

            if (!department) return res.status(409).json({ error: "No department found with that id" });
        }

        const [updatedSubject] = await db
            .update(subjects)
            .set({
                name,
                code,
                description,
                imageCldPubId,
                departmentId: departmentId !== undefined ? Number(departmentId) : undefined,
            })
            .where(and(eq(subjects.id, subjectId), eq(subjects.workspaceId, req.workspaceId!)))
            .returning();

        if (!updatedSubject) return res.status(404).json({ error: "No subject found" });

        // One photo, one department: uploading an image to any subject spreads
        // it to every sibling subject in the same department, so a single
        // upload covers the whole department instead of needing one per
        // subject. Only fires on a real upload (not on clearing an image), and
        // never overrides a department change made in this same request.
        if (imageCldPubId) {
            await db
                .update(subjects)
                .set({ imageCldPubId })
                .where(and(
                    eq(subjects.departmentId, updatedSubject.departmentId),
                    eq(subjects.workspaceId, req.workspaceId!),
                    ne(subjects.id, subjectId),
                ));
        }

        res.status(200).json({ data: updatedSubject });
    } catch (e: any) {
        if (pgErrorCode(e) === "23505") {
            return res.status(409).json({ error: "A subject with this code already exists" });
        }
        if (pgErrorCode(e) === "23503") {
            return res.status(409).json({ error: "No department found with that id" });
        }
        console.error(`PUT /subjects/:id error: ${e}`);
        res.status(500).json({ error: "Failed to update subject" });
    }
});

router.delete("/:id", domainWriteRateLimit, async (req, res) => {
    try {
        const subjectId = Number(req.params.id);
        if (!Number.isFinite(subjectId)) return res.status(404).json({ error: "No subject found" });

        const [deletedSubject] = await db
            .delete(subjects)
            .where(and(eq(subjects.id, subjectId), eq(subjects.workspaceId, req.workspaceId!)))
            .returning({ id: subjects.id });

        if (!deletedSubject) return res.status(404).json({ error: "No subject found" });

        res.status(200).json({ data: deletedSubject });
    } catch (e: any) {
        if (pgErrorCode(e) === "23503") {
            return res.status(409).json({ error: "Cannot delete subject: it still has classes assigned to it" });
        }
        console.error(`DELETE /subjects/:id error: ${e}`);
        res.status(500).json({ error: "Failed to delete subject" });
    }
});

export default router;
