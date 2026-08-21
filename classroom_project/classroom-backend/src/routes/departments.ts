import express from "express";
import { db } from "../db/index.js";
import { departments, subjects } from "../db/schema/index.js";
import { and, asc, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/authorize.js";
import workspaceMiddleware from "../middleware/workspace.js";
import { enforceRowQuota } from "../middleware/rowQuota.js";

const router = express.Router();

// Drizzle wraps the underlying Postgres error in `.cause`, so the SQLSTATE code can live on either.
const pgErrorCode = (e: any): string | undefined => e?.code ?? e?.cause?.code;

const SORTABLE_DEPARTMENT_FIELDS = {
    id: departments.id,
    name: departments.name,
    code: departments.code,
    createdAt: departments.createdAt,
} as const;

router.use(requireAuth, workspaceMiddleware);

// Get all departments with optional search, sorting and pagination
router.get("/", async (req, res) => {
    try {
        const { search, page = 1, limit = 10, sortField, sortOrder } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const sortColumn = SORTABLE_DEPARTMENT_FIELDS[String(sortField) as keyof typeof SORTABLE_DEPARTMENT_FIELDS];
        const orderByClause = sortColumn
            ? (sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn))
            : desc(departments.createdAt);

        const filterConditions = [eq(departments.workspaceId, req.workspaceId!)];
        // If search query exists, filter by department name OR code
        if (search) {
            filterConditions.push(
                or(
                    ilike(departments.name, `%${search}%`),
                    ilike(departments.code, `%${search}%`),
                )!
            );
        }
        const whereClause = and(...filterConditions);

        const countResults = await db
            .select({ count: sql<number>`count(*)` })
            .from(departments)
            .where(whereClause);

        const totalCount = countResults[0]?.count ?? 0;

        const departmentsList = await db
            .select({
                ...getTableColumns(departments),
                subjectCount: sql<number>`count(${subjects.id})`,
            })
            .from(departments)
            .leftJoin(subjects, eq(subjects.departmentId, departments.id))
            .where(whereClause)
            .groupBy(departments.id)
            .orderBy(orderByClause)
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: departmentsList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }
        });
    } catch (e) {
        console.error(`GET /departments error: ${e}`);
        res.status(500).json({ error: "Failed to load departments" });
    }
});

// Get a single department with its subjects
router.get("/:id", async (req, res) => {
    try {
        const departmentId = Number(req.params.id);
        if (!Number.isFinite(departmentId)) return res.status(404).json({ error: "No department found" });

        const [department] = await db
            .select()
            .from(departments)
            .where(and(eq(departments.id, departmentId), eq(departments.workspaceId, req.workspaceId!)));

        if (!department) return res.status(404).json({ error: "No department found" });

        const departmentSubjects = await db
            .select()
            .from(subjects)
            .where(and(eq(subjects.departmentId, departmentId), eq(subjects.workspaceId, req.workspaceId!)))
            .orderBy(desc(subjects.createdAt));

        res.status(200).json({ data: { ...department, subjects: departmentSubjects } });
    } catch (e) {
        console.error(`GET /departments/:id error: ${e}`);
        res.status(500).json({ error: "Failed to load department" });
    }
});

router.post("/", enforceRowQuota(departments, departments.workspaceId, "department"), async (req, res) => {
    try {
        const { name, code, description } = req.body;

        if (!name || !code) {
            return res.status(400).json({ error: "Name and code are required" });
        }

        const [createdDepartment] = await db
            .insert(departments)
            .values({ name, code, description, workspaceId: req.workspaceId! })
            .returning();

        res.status(201).json({ data: createdDepartment });
    } catch (e: any) {
        if (pgErrorCode(e) === "23505") {
            return res.status(409).json({ error: "A department with this code already exists" });
        }
        console.error(`POST /departments error: ${e}`);
        res.status(500).json({ error: "Failed to create department" });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const departmentId = Number(req.params.id);
        if (!Number.isFinite(departmentId)) return res.status(404).json({ error: "No department found" });

        const { name, code, description } = req.body;

        const [updatedDepartment] = await db
            .update(departments)
            .set({ name, code, description })
            .where(and(eq(departments.id, departmentId), eq(departments.workspaceId, req.workspaceId!)))
            .returning();

        if (!updatedDepartment) return res.status(404).json({ error: "No department found" });

        res.status(200).json({ data: updatedDepartment });
    } catch (e: any) {
        if (pgErrorCode(e) === "23505") {
            return res.status(409).json({ error: "A department with this code already exists" });
        }
        console.error(`PUT /departments/:id error: ${e}`);
        res.status(500).json({ error: "Failed to update department" });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const departmentId = Number(req.params.id);
        if (!Number.isFinite(departmentId)) return res.status(404).json({ error: "No department found" });

        const [deletedDepartment] = await db
            .delete(departments)
            .where(and(eq(departments.id, departmentId), eq(departments.workspaceId, req.workspaceId!)))
            .returning({ id: departments.id });

        if (!deletedDepartment) return res.status(404).json({ error: "No department found" });

        res.status(200).json({ data: deletedDepartment });
    } catch (e: any) {
        if (pgErrorCode(e) === "23503") {
            return res.status(409).json({ error: "Cannot delete department: it still has subjects assigned to it" });
        }
        console.error(`DELETE /departments/:id error: ${e}`);
        res.status(500).json({ error: "Failed to delete department" });
    }
});

export default router;
