import express from "express";
import {classes, enrollments, roleEnum, subjects, user} from "../db/schema/index.js";
import {and, asc, desc, eq, getTableColumns, ilike, or, sql} from "drizzle-orm";
import {db} from "../db/index.js";
import {randomUUID} from "crypto";
import {requireAdmin} from "../middleware/authorize.js";
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

// Get all users switch optional search, role filtering and pagination
router.get("/", async (req, res) => {
    try {
        const { search, role, page = 1, limit = 10, sortField, sortOrder } = req.query;

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

        res.status(200).json({
            data: usersList,
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

// Get a single user, with the classes they teach and/or the classes they're enrolled in
router.get("/:id", async (req, res) => {
    try {
        const userId = req.params.id;

        const [foundUser] = await db.select().from(user).where(eq(user.id, userId));

        if (!foundUser) return res.status(404).json({ error: "No user found" });

        const classesTaught = await db
            .select({
                ...getTableColumns(classes),
                subject: { ...getTableColumns(subjects) },
            })
            .from(classes)
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
            .where(eq(classes.teacherId, userId))
            .orderBy(desc(classes.createdAt));

        const enrolledClasses = await db
            .select({
                ...getTableColumns(enrollments),
                class: { ...getTableColumns(classes) },
            })
            .from(enrollments)
            .leftJoin(classes, eq(enrollments.classId, classes.id))
            .where(eq(enrollments.studentId, userId))
            .orderBy(desc(enrollments.createdAt));

        res.status(200).json({ data: { ...foundUser, classesTaught, enrolledClasses } });
    } catch (e) {
        console.error(`GET /users/:id error: ${e}`);
        res.status(500).json({ error: "Failed to load user" });
    }
});

router.post("/", requireAdmin, async (req, res) => {
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

router.put("/:id", requireAdmin, async (req, res) => {
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

router.delete("/:id", requireAdmin, async (req, res) => {
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
