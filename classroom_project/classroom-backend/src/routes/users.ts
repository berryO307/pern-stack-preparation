import express, { type Request, type Response } from "express";
import {classes, departments, enrollments, roleEnum, subjects, user} from "../db/schema/index.js";
import {and, asc, desc, eq, getTableColumns, gte, ilike, inArray, lt, or, sql} from "drizzle-orm";
import {db} from "../db/index.js";
import {randomUUID} from "crypto";
import {requireAdmin, requireAuth} from "../middleware/authorize.js";
import workspaceMiddleware from "../middleware/workspace.js";
import domainWriteRateLimit from "../middleware/domainWriteRateLimit.js";
const router = express.Router();

const pgErrorCode = (e: any): string | undefined => e?.code ?? e?.cause?.code;

// Postgres' own `role` enum column already rejects out-of-domain values, but
// only as a raw DB error (500) — this gives a clean 400 instead.
const isValidRole = (value: unknown): value is typeof roleEnum.enumValues[number] =>
    typeof value === "string" && (roleEnum.enumValues as readonly string[]).includes(value);

const SORTABLE_USER_FIELDS = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
} as const;

// Faculty's list view shows Department instead of Role (every row there is
// already role=teacher, so Role is dead weight) - department isn't a direct
// column on `user` since a teacher isn't assigned to one, only inferred from
// what they teach. This picks each teacher's most-recently-created class in
// the CALLER's own workspace (classes are workspace-scoped, teacher
// identities aren't) and returns its department - a single well-defined
// tiebreak rather than "most frequent", which could tie. Returns a Map so a
// teacher with no classes yet in this workspace simply has no entry.
const deriveTeacherDepartments = async (
    teacherIds: string[],
    workspaceId: string
): Promise<Map<string, { id: number; name: string }>> => {
    if (teacherIds.length === 0) return new Map();

    const rows = await db
        .selectDistinctOn([classes.teacherId], {
            teacherId: classes.teacherId,
            departmentId: departments.id,
            departmentName: departments.name,
        })
        .from(classes)
        .innerJoin(subjects, eq(classes.subjectId, subjects.id))
        .innerJoin(departments, eq(subjects.departmentId, departments.id))
        .where(and(eq(classes.workspaceId, workspaceId), inArray(classes.teacherId, teacherIds)))
        .orderBy(classes.teacherId, desc(classes.createdAt));

    return new Map(rows.map((r) => [r.teacherId, { id: r.departmentId, name: r.departmentName }]));
};

// Get all users switch optional search, role filtering and pagination
router.get("/", requireAuth, workspaceMiddleware, async (req, res) => {
    try {
        const { search, role, dateFrom, dateTo, page = 1, limit = 10, sortField, sortOrder } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const sortColumn = SORTABLE_USER_FIELDS[String(sortField) as keyof typeof SORTABLE_USER_FIELDS];
        const orderByClause = sortColumn
            ? (sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn))
            : desc(user.createdAt);

        const filterConditions = [];
        // If search query exists, filter by user name OR email
        if (search) {
            filterConditions.push(
                or(
                    ilike(user.name, `%${search}%`),
                    ilike(user.email, `%${search}%`),
                )
            );
        }
        // If role filter exists, match role exactly
        if (role) {
            if (!isValidRole(role)) {
                return res.status(400).json({ error: "Invalid role filter" });
            }
            filterConditions.push(eq(user.role, role));
        }
        // Date range filters on createdAt (the account's "joined" date) - dateTo
        // is inclusive of the whole day, so the upper bound is exclusive of the
        // NEXT day rather than a `lte` against midnight of dateTo itself.
        if (dateFrom) {
            const from = new Date(String(dateFrom));
            if (Number.isNaN(from.getTime())) return res.status(400).json({ error: "Invalid dateFrom" });
            filterConditions.push(gte(user.createdAt, from));
        }
        if (dateTo) {
            const to = new Date(String(dateTo));
            if (Number.isNaN(to.getTime())) return res.status(400).json({ error: "Invalid dateTo" });
            const exclusiveUpperBound = new Date(to);
            exclusiveUpperBound.setDate(exclusiveUpperBound.getDate() + 1);
            filterConditions.push(lt(user.createdAt, exclusiveUpperBound));
        }
        // Combine all filters using AND if any exist
        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;
        const countResults = await db
            .select({ count: sql<number>`count(*)` })
            .from(user)
            .where(whereClause);

        const totalCount = countResults[0] ?.count ?? 0;
        const usersList = await db.select({
            ...getTableColumns(user),
        }).from(user)
            .where(whereClause)
            .orderBy(orderByClause)
            .limit(limitPerPage)
            .offset(offset);

        const teacherIds = usersList.filter((u) => u.role === "teacher").map((u) => u.id);
        const departmentByTeacherId = await deriveTeacherDepartments(teacherIds, req.workspaceId!);
        const usersListWithDepartment = usersList.map((u) => ({
            ...u,
            department: departmentByTeacherId.get(u.id) ?? null,
        }));

        res.status(200).json({
            data: usersListWithDepartment,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }
        })

    }catch (e) {
        console.error(`GET /users error: ${e}`);
        res.status(500).json({ error: 'Failed to load users' });
    }
})

// Get a single user, with the classes they teach and/or the classes they're enrolled in,
// scoped to the caller's own workspace since teacher/student fixture identities are
// shared across every workspace but their classes/enrollments are not.
router.get("/:id", requireAuth, workspaceMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.params.id;

        const [foundUser] = await db.select().from(user).where(sql`${user.id} = ${userId}`);

        if (!foundUser) return res.status(404).json({ error: "No user found" });

        const classesTaught = await db
            .select({
                ...getTableColumns(classes),
                subject: { ...getTableColumns(subjects) },
                department: { ...getTableColumns(departments) },
            })
            .from(classes)
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(sql`${classes.teacherId} = ${userId} AND ${classes.workspaceId} = ${req.workspaceId!}`)
            .orderBy(desc(classes.createdAt));

        const enrolledClasses = await db
            .select({
                ...getTableColumns(enrollments),
                class: { ...getTableColumns(classes) },
            })
            .from(enrollments)
            .leftJoin(classes, eq(enrollments.classId, classes.id))
            .where(sql`${enrollments.studentId} = ${userId} AND ${enrollments.workspaceId} = ${req.workspaceId!}`)
            .orderBy(desc(enrollments.createdAt));

        res.status(200).json({ data: { ...foundUser, classesTaught, enrolledClasses } });
    } catch (e) {
        console.error(`GET /users/:id error: ${e}`);
        res.status(500).json({ error: "Failed to load user" });
    }
});

router.post("/", requireAdmin, domainWriteRateLimit, async (req, res) => {
    try {
        const { name, email, role, image, imageCldPubId } = req.body;

        if (!name || !email || !role) {
            return res.status(400).json({ error: "Name, email and role are required" });
        }
        if (!isValidRole(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }

        const [createdUser] = await db
            .insert(user)
            .values({ id: randomUUID(), name, email, role, image, imageCldPubId })
            .returning();

        res.status(201).json({ data: createdUser });
    } catch (e: any) {
        if (pgErrorCode(e) === "23505") {
            return res.status(409).json({ error: "A user with this email already exists" });
        }
        console.error(`POST /users error: ${e}`);
        res.status(500).json({ error: "Failed to create user" });
    }
});

router.put("/:id", requireAdmin, domainWriteRateLimit, async (req, res) => {
    try {
        const userId = req.params.id;
        const { name, email, role, image, imageCldPubId } = req.body;

        if (role !== undefined && !isValidRole(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }

        const [updatedUser] = await db
            .update(user)
            .set({ name, email, role, image, imageCldPubId })
            .where(sql`${user.id} = ${userId}`)
            .returning();

        if (!updatedUser) return res.status(404).json({ error: "No user found" });

        res.status(200).json({ data: updatedUser });
    } catch (e: any) {
        if (pgErrorCode(e) === "23505") {
            return res.status(409).json({ error: "A user with this email already exists" });
        }
        console.error(`PUT /users/:id error: ${e}`);
        res.status(500).json({ error: "Failed to update user" });
    }
});

router.delete("/:id", requireAdmin, domainWriteRateLimit, async (req, res) => {
    try {
        const userId = req.params.id;

        const [deletedUser] = await db
            .delete(user)
            .where(sql`${user.id} = ${userId}`)
            .returning({ id: user.id });

        if (!deletedUser) return res.status(404).json({ error: "No user found" });

        res.status(200).json({ data: deletedUser });
    } catch (e: any) {
        if (pgErrorCode(e) === "23503") {
            return res.status(409).json({ error: "Cannot delete user: they are still assigned as a teacher to one or more classes" });
        }
        console.error(`DELETE /users/:id error: ${e}`);
        res.status(500).json({ error: "Failed to delete user" });
    }
});

export default router;
