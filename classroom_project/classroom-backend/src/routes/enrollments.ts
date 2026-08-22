import express from "express";
import { db } from "../db/index.js";
import { classes, enrollments, subjects, user } from "../db/schema/index.js";
import { and, asc, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/authorize.js";
import workspaceMiddleware from "../middleware/workspace.js";
import { enforceRowQuota } from "../middleware/rowQuota.js";
import domainWriteRateLimit from "../middleware/domainWriteRateLimit.js";
import { INVITE_CODE_PATTERN } from "../lib/inviteCode.js";
import { recordFailedCodeAttempt } from "../lib/enrollmentCodeAttempts.js";

const router = express.Router();

const pgErrorCode = (e: any): string | undefined => e?.code ?? e?.cause?.code;

const SORTABLE_ENROLLMENT_FIELDS = {
    createdAt: enrollments.createdAt,
    student: user.name,
    class: classes.name,
} as const;

router.use(requireAuth, workspaceMiddleware);

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

        const filterConditions = [eq(enrollments.workspaceId, req.workspaceId!)];
        if (classId) filterConditions.push(eq(enrollments.classId, Number(classId)));
        if (studentId) filterConditions.push(eq(enrollments.studentId, String(studentId)));
        if (search) {
            filterConditions.push(
                or(
                    ilike(user.name, `%${search}%`),
                    ilike(user.email, `%${search}%`),
                    ilike(classes.name, `%${search}%`),
                )!
            );
        }
        const whereClause = and(...filterConditions);

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

// Self-enrollment: a signed-in visitor enrolls an email address (defaulting
// to their own) into a class they prove access to via that class's invite
// code. classId is still submitted (the combobox selection) but only as a
// cross-check against the code - the code is what actually authorizes the
// enrollment, not the selection.
router.post("/", domainWriteRateLimit, enforceRowQuota(enrollments, enrollments.workspaceId, "enrollment"), async (req, res) => {
    try {
        const { classId: rawClassId, email: rawEmail, inviteCode: rawInviteCode } = req.body;
        const classId = Number(rawClassId);
        const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
        const inviteCode = typeof rawInviteCode === "string" ? rawInviteCode.trim().toUpperCase() : "";

        if (!Number.isFinite(classId) || classId <= 0) {
            return res.status(422).json({ errors: { classId: "Select a class." } });
        }
        if (!email) {
            return res.status(422).json({ errors: { email: "Email is required." } });
        }

        // 1. Code format - client-side check is format-only too, so this is
        // the first line of defense, not a formality.
        if (!INVITE_CODE_PATTERN.test(inviteCode)) {
            await recordFailedCodeAttempt(req, req.user!.id);
            return res.status(422).json({
                errors: { inviteCode: "Codes are 3 letters followed by 3 digits, like CSE101." },
            });
        }

        // 2. A class with that code exists in the caller's own workspace -
        // never leak whether a code is valid in some OTHER workspace.
        const [codeClass] = await db
            .select({ id: classes.id })
            .from(classes)
            .where(and(eq(classes.workspaceId, req.workspaceId!), eq(classes.inviteCode, inviteCode)));

        if (!codeClass) {
            const allowed = await recordFailedCodeAttempt(req, req.user!.id);
            if (!allowed) {
                return res.status(429).json({ error: "Too many code attempts - please wait a bit before trying again." });
            }
            return res.status(422).json({ errors: { inviteCode: "That code doesn't match any class." } });
        }

        // 3. The code has to belong to the class actually selected in the
        // form - otherwise someone could enroll in class B using class A's
        // invite code just because both happen to be valid codes somewhere.
        if (codeClass.id !== classId) {
            const allowed = await recordFailedCodeAttempt(req, req.user!.id);
            if (!allowed) {
                return res.status(429).json({ error: "Too many code attempts - please wait a bit before trying again." });
            }
            return res.status(422).json({ errors: { inviteCode: "That code belongs to a different class." } });
        }

        // Resolve the email to an existing user - self-enrollment doesn't
        // create accounts on the fly, it enrolls an email that's already a
        // real identity (a signed-in visitor or one of the seeded fixtures).
        const [matchedUser] = await db
            .select({ id: user.id })
            .from(user)
            .where(sql`lower(${user.email}) = ${email}`);

        if (!matchedUser) {
            return res.status(422).json({ errors: { email: "No student found with that email." } });
        }

        // Neon's HTTP driver has no interactive transactions (a session can't hold
        // a lock across separate round trips), but `db.batch` sends a fixed list
        // of queries as one atomic Postgres transaction. Locking the class row
        // with FOR UPDATE first means a concurrent enrollment on the same class
        // blocks until this one commits, so the capacity check the INSERT's WHERE
        // clause does can't race against another request's insert. A 0-row
        // result here (no unique-constraint violation, just nothing to insert)
        // means capacity was the blocker; a genuine duplicate instead throws
        // 23505 below, so the two failure modes stay distinguishable.
        const [, insertResult] = await db.batch([
            db.execute(sql`SELECT capacity FROM ${classes} WHERE ${classes.id} = ${classId} FOR UPDATE`),
            db.execute(sql`
                INSERT INTO ${enrollments} (class_id, student_id, workspace_id)
                SELECT ${classId}, ${matchedUser.id}, ${req.workspaceId!}
                WHERE (SELECT count(*) FROM ${enrollments} WHERE class_id = ${classId})
                    < (SELECT capacity FROM ${classes} WHERE id = ${classId})
                RETURNING *
            `),
        ]);

        const createdEnrollment = (insertResult as unknown as { rows: (typeof enrollments.$inferSelect)[] }).rows[0];

        if (!createdEnrollment) {
            return res.status(422).json({ errors: { classId: "This class is full." } });
        }

        res.status(201).json({ data: createdEnrollment });
    } catch (e: any) {
        if (pgErrorCode(e) === "23505") {
            return res.status(422).json({
                errors: { email: "That email is already enrolled in this class." },
            });
        }
        console.error(`POST /enrollments error: ${e}`);
        res.status(500).json({ error: "Failed to enroll student" });
    }
});

router.delete("/:id", domainWriteRateLimit, async (req, res) => {
    try {
        const enrollmentId = Number(req.params.id);
        if (!Number.isFinite(enrollmentId)) return res.status(404).json({ error: "No enrollment found" });

        const [deletedEnrollment] = await db
            .delete(enrollments)
            .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.workspaceId, req.workspaceId!)))
            .returning({ id: enrollments.id });

        if (!deletedEnrollment) return res.status(404).json({ error: "No enrollment found" });

        res.status(200).json({ data: deletedEnrollment });
    } catch (e) {
        console.error(`DELETE /enrollments/:id error: ${e}`);
        res.status(500).json({ error: "Failed to unenroll student" });
    }
});

export default router;
