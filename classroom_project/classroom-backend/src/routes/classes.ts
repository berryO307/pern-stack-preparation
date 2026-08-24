import express from "express";
import {db} from "../db/index.js";
import {classes, classStatusEnum, departments, enrollments, subjects, user} from "../db/schema/index.js";
import {and, asc, desc, eq, getTableColumns, ilike, inArray, or, sql} from "drizzle-orm";
import {requireAuth} from "../middleware/authorize.js";
import workspaceMiddleware from "../middleware/workspace.js";
import {enforceRowQuota} from "../middleware/rowQuota.js";
import domainWriteRateLimit from "../middleware/domainWriteRateLimit.js";
import {generateInviteCode} from "../lib/inviteCode.js";

const router = express.Router();

// Escapes ILIKE wildcard/escape characters so a literal search for e.g. "50%"
// or "a_b" doesn't get interpreted as a wildcard pattern.
const escapeLike = (value: string) => value.replace(/[%_\\]/g, "\\$&");

const pgErrorCode = (e: any): string | undefined => e?.code ?? e?.cause?.code;

// Fill rate isn't a stored column — compute it inline so it's sortable like any
// other field (used by the dashboard capacity chart's "View full report" link).
// Only 'active' enrollments occupy a seat - waitlisted/dropped rows exist for
// realism but must not count against capacity.
const fillRateExpr = sql`CASE WHEN ${classes.capacity} > 0
    THEN (SELECT count(*)::numeric FROM ${enrollments} WHERE ${enrollments.classId} = ${classes.id} AND ${enrollments.status} = 'active') / ${classes.capacity}
    ELSE 0 END`;

const SORTABLE_CLASS_FIELDS = {
    id: classes.id,
    name: classes.name,
    capacity: classes.capacity,
    status: classes.status,
    createdAt: classes.createdAt,
    fillRate: fillRateExpr,
} as const;

router.use(requireAuth, workspaceMiddleware);

router.post('/', domainWriteRateLimit, enforceRowQuota(classes, classes.workspaceId, "class"), async (req, res) => {
    try {
        const { name, teacherId, subjectId, capacity, description, status, bannerUrl, bannerCldPubId } = req.body;

        if (!name || !teacherId || !subjectId) {
            return res.status(400).json({error: "Name, teacher and subject are required"});
        }
        if (capacity !== undefined && (!Number.isFinite(Number(capacity)) || Number(capacity) <= 0)) {
            return res.status(400).json({error: "Capacity must be a positive number"});
        }

        const [subject] = await db
            .select({ id: subjects.id })
            .from(subjects)
            .where(and(eq(subjects.id, Number(subjectId)), eq(subjects.workspaceId, req.workspaceId!)));

        if (!subject) return res.status(409).json({ error: "No subject found with that id" });

        const [createdClass] = await db
            .insert(classes)
            .values({
                name, teacherId, subjectId, capacity, description, status, bannerUrl, bannerCldPubId,
                inviteCode: await generateInviteCode(req.workspaceId!),
                schedules: [],
                workspaceId: req.workspaceId!,
            })
            .returning({ id: classes.id});

        if (!createdClass) throw Error;

        res.status(201).json({data: createdClass});

    }catch(e) {
        console.error(`POST /classes error: ${e}`);
        res.status(500).json({error: 'Failed to create class'});

    }
})

router.put('/:id', domainWriteRateLimit, async (req, res) => {
    try {
        const classId = Number(req.params.id);
        if (!Number.isFinite(classId)) return res.status(404).json({ error: "No class found" });

        const { name, teacherId, subjectId, capacity, description, status, bannerUrl, bannerCldPubId } = req.body;

        if (capacity !== undefined && (!Number.isFinite(Number(capacity)) || Number(capacity) <= 0)) {
            return res.status(400).json({ error: "Capacity must be a positive number" });
        }

        if (subjectId !== undefined) {
            const [subject] = await db
                .select({ id: subjects.id })
                .from(subjects)
                .where(and(eq(subjects.id, Number(subjectId)), eq(subjects.workspaceId, req.workspaceId!)));

            if (!subject) return res.status(409).json({ error: "No subject found with that id" });
        }

        const [updatedClass] = await db
            .update(classes)
            .set({
                name,
                teacherId,
                subjectId: subjectId !== undefined ? Number(subjectId) : undefined,
                capacity,
                description,
                status,
                bannerUrl,
                bannerCldPubId,
            })
            .where(and(eq(classes.id, classId), eq(classes.workspaceId, req.workspaceId!)))
            .returning();

        if (!updatedClass) return res.status(404).json({ error: "No class found" });

        res.status(200).json({ data: updatedClass });
    } catch (e: any) {
        if (pgErrorCode(e) === "23503") {
            return res.status(409).json({ error: "No teacher found with that id" });
        }
        console.error(`PUT /classes/:id error: ${e}`);
        res.status(500).json({ error: "Failed to update class" });
    }
});

// Get all classes with optional search, filtering and pagination
router.get("/", async (req, res) => {
    try {
        const { search, subject, subjectId, departmentId, teacher, status, capacityBucket, page = 1, limit = 10, sortField, sortOrder } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        // Validate the requested sort field/direction, falling back to the default ordering
        const sortColumn = SORTABLE_CLASS_FIELDS[String(sortField) as keyof typeof SORTABLE_CLASS_FIELDS];
        const orderByClause = sortColumn
            ? (sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn))
            : desc(classes.createdAt);

        const filterConditions = [eq(classes.workspaceId, req.workspaceId!)];
        // If search query exists, filter by class name OR invite code
        if (search) {
            const searchPattern = `%${escapeLike(String(search))}%`;
            filterConditions.push(
                or(
                    ilike(classes.name, searchPattern),
                    ilike(classes.inviteCode, searchPattern),
                )!
            );
        }
        // If subject filter exists, match subject name
        if (subject) {
            const subjectPattern = `%${String(subject).replace(/[%_]/g, '\\$&')}%`;
            filterConditions.push(ilike(subjects.name, subjectPattern));
        }
        // If subjectId filter exists, match the subject exactly - used by the
        // subject detail page to list its own sections without relying on a
        // fuzzy name match.
        if (subjectId) {
            const parsedSubjectId = Number(subjectId);
            if (!Number.isFinite(parsedSubjectId)) {
                return res.status(400).json({ error: "Invalid subjectId filter" });
            }
            filterConditions.push(eq(classes.subjectId, parsedSubjectId));
        }
        // If departmentId filter exists, match every class whose subject
        // belongs to that department - used by the department detail page's
        // Classes section. subjects is already joined below, so this filters
        // against it directly rather than adding a departments join.
        if (departmentId) {
            const parsedDepartmentId = Number(departmentId);
            if (!Number.isFinite(parsedDepartmentId)) {
                return res.status(400).json({ error: "Invalid departmentId filter" });
            }
            filterConditions.push(eq(subjects.departmentId, parsedDepartmentId));
        }
        // If teacher filter exists, match teacher name
        if (teacher) {
            const teacherPattern = `%${String(teacher).replace(/[%_]/g, '\\$&')}%`;
            filterConditions.push(ilike(user.name, teacherPattern));
        }
        // Comma-separated (?status=active,inactive) so "active or inactive,
        // but not archived" is expressible as one filter.
        if (status) {
            const requested = String(status).split(",").map((s) => s.trim());
            const validStatuses = requested.filter((s): s is typeof classStatusEnum.enumValues[number] =>
                (classStatusEnum.enumValues as readonly string[]).includes(s)
            );
            if (validStatuses.length === 0) {
                return res.status(400).json({ error: "Invalid status filter" });
            }
            filterConditions.push(inArray(classes.status, validStatuses));
        }
        // Mirrors the dashboard capacity donut's own bucket thresholds
        // exactly (routes/dashboard.ts's capacity_bucketed CTE) - this is
        // what makes clicking a donut segment/legend row a real filtered
        // view instead of decoration. Classes with no capacity set are
        // never included in any bucket, same as the donut itself excludes
        // them rather than lying that they're "0-20%".
        if (capacityBucket) {
            const bucketRanges: Record<string, { min: number; max: number }> = {
                "81-100": { min: 0.8, max: 1.0001 },
                "61-80": { min: 0.6, max: 0.8 },
                "41-60": { min: 0.4, max: 0.6 },
                "21-40": { min: 0.2, max: 0.4 },
                "0-20": { min: -0.0001, max: 0.2 },
            };
            const range = bucketRanges[String(capacityBucket)];
            if (!range) {
                return res.status(400).json({ error: "Invalid capacityBucket filter" });
            }
            filterConditions.push(sql`${classes.capacity} > 0`);
            filterConditions.push(sql`(${fillRateExpr}) > ${range.min} AND (${fillRateExpr}) <= ${range.max}`);
        }
        const whereClause = and(...filterConditions);
        const countResults = await db
            .select({ count: sql<number>`count(*)` })
            .from(classes)
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
            .leftJoin(user, eq(classes.teacherId, user.id))
            .where(whereClause);

        const totalCount = countResults[0]?.count ?? 0;
        const classesList = await db.select({
            ...getTableColumns(classes),
            subject: { ...getTableColumns(subjects) },
            department: { ...getTableColumns(departments) },
            teacher: { ...getTableColumns(user) },
            // Used by the enrollment combobox to show/disable remaining seats
            // without a second round trip per class. Only 'active' rows occupy
            // a seat.
            enrolledCount: sql<number>`(SELECT count(*)::int FROM ${enrollments} WHERE ${enrollments.classId} = ${classes.id} AND ${enrollments.status} = 'active')`,
        }).from(classes)
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .leftJoin(user, eq(classes.teacherId, user.id))
            .where(whereClause)
            .orderBy(orderByClause)
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: classesList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }
        })

    } catch (e) {
        console.error(`GET /classes error: ${e}`);
        res.status(500).json({ error: 'Failed to load classes' });
    }
})

//Get all class details with teacher, subject, and department
router.get('/:id', async (req, res) => {
    const classId = Number(req.params.id);

    if (!Number.isFinite(classId)) return res.status(404).json({error: "No class found"});

    const [classDetail] = await db
        .select({
            ...getTableColumns(classes),
            subject: {
                ...getTableColumns(subjects),
            },
            department: {
                ...getTableColumns(departments),
            },
            teacher: {
                ...getTableColumns(user),
            }
        })
        .from(classes)
        .leftJoin(subjects, eq(classes.subjectId, subjects.id))
        .leftJoin(user, eq(classes.teacherId, user.id))
        .leftJoin(departments, eq(subjects.departmentId, departments.id))
        .where(and(eq(classes.id, classId), eq(classes.workspaceId, req.workspaceId!)))

    if (!classDetail) return res.status(404).json({error: "No class found"});

    const enrolledCountResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(enrollments)
        .where(and(eq(enrollments.classId, classId), eq(enrollments.status, "active")));

    res.status(200).json({data: {...classDetail, enrolledCount: Number(enrolledCountResult[0]?.count ?? 0)}});
})

export default router;
