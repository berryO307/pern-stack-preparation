import express from "express";
import {departments, subjects} from "../db/schema/index.js";
import {and, desc, eq, getTableColumns, ilike, or, sql} from "drizzle-orm";
import {db} from "../db/index.js";
import {requireAdmin} from "../middleware/authorize.js";
const router = express.Router();

const pgErrorCode = (e: any): string | undefined => e?.code ?? e?.cause?.code;

// Escapes ILIKE wildcard/escape characters so a literal search for e.g. "50%"
// or "a_b" doesn't get interpreted as a wildcard pattern.
const escapeLike = (value: string) => value.replace(/[%_\\]/g, "\\$&");

// Get all subjects switch optional search, filtering and pagination
router.get("/", async (req, res) => {
    try {
        const { search, department, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;
        const filterConditions = [];
        // If search query exists, filter by subject name OR subject code
        if (search) {
            const searchPattern = `%${escapeLike(String(search))}%`;
            filterConditions.push(
                or(
                    ilike(subjects.name, searchPattern),
                    ilike(subjects.code, searchPattern),
                )
            );
        }
        // If department filter exists, match department name
        if (department) {
            const deptPattern = `%${String(department).replace(/[%_]/g, '\\$&')}%`;
            filterConditions.push(ilike(departments.name, deptPattern));
        }
        // Combine all filters using AND if any exist
        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;
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
            .where(eq(subjects.id, subjectId));

        if (!subject) return res.status(404).json({ error: "No subject found" });

        res.status(200).json({ data: subject });
    } catch (e) {
        console.error(`GET /subjects/:id error: ${e}`);
        res.status(500).json({ error: "Failed to load subject" });
    }
});

router.post("/", requireAdmin, async (req, res) => {
    try {
        const { name, code, description, departmentId } = req.body;

        if (!name || !code || !departmentId) {
            return res.status(400).json({ error: "Name, code and department are required" });
        }

        const [createdSubject] = await db
            .insert(subjects)
            .values({ name, code, description, departmentId: Number(departmentId) })
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

router.put("/:id", requireAdmin, async (req, res) => {
    try {
        const subjectId = Number(req.params.id);
        if (!Number.isFinite(subjectId)) return res.status(404).json({ error: "No subject found" });

        const { name, code, description, departmentId } = req.body;

        const [updatedSubject] = await db
            .update(subjects)
            .set({
                name,
                code,
                description,
                departmentId: departmentId !== undefined ? Number(departmentId) : undefined,
            })
            .where(eq(subjects.id, subjectId))
            .returning();

        if (!updatedSubject) return res.status(404).json({ error: "No subject found" });

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

router.delete("/:id", requireAdmin, async (req, res) => {
    try {
        const subjectId = Number(req.params.id);
        if (!Number.isFinite(subjectId)) return res.status(404).json({ error: "No subject found" });

        const [deletedSubject] = await db
            .delete(subjects)
            .where(eq(subjects.id, subjectId))
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