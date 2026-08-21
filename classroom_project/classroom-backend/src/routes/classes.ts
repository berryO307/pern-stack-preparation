import express from "express";
import {db} from "../db/index.js";
import {classes, classStatusEnum, departments, enrollments, subjects, user} from "../db/schema/index.js";
import {and, asc, desc, eq, getTableColumns, ilike, or, sql} from "drizzle-orm";
import {requireAuth} from "../middleware/authorize.js";
import workspaceMiddleware from "../middleware/workspace.js";

const router = express.Router();

// Escapes ILIKE wildcard/escape characters so a literal search for e.g. "50%"
// or "a_b" doesn't get interpreted as a wildcard pattern.
const escapeLike = (value: string) => value.replace(/[%_\\]/g, "\\$&");

// Fill rate isn't a stored column — compute it inline so it's sortable like any
// other field (used by the dashboard capacity chart's "View full report" link).
const fillRateExpr = sql`CASE WHEN ${classes.capacity} > 0
    THEN (SELECT count(*)::numeric FROM ${enrollments} WHERE ${enrollments.classId} = ${classes.id}) / ${classes.capacity}
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

router.post('/', async (req, res) => {
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
                inviteCode: Math.random().toString(36).substring(2, 9),
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

// Get all classes with optional search, filtering and pagination
router.get("/", async (req, res) => {
    try {
        const { search, subject, teacher, status, page = 1, limit = 10, sortField, sortOrder } = req.query;

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
        // If teacher filter exists, match teacher name
        if (teacher) {
            const teacherPattern = `%${String(teacher).replace(/[%_]/g, '\\$&')}%`;
            filterConditions.push(ilike(user.name, teacherPattern));
        }
        // If status filter exists, match status exactly
        if (status) {
            if (!(classStatusEnum.enumValues as readonly string[]).includes(String(status))) {
                return res.status(400).json({ error: "Invalid status filter" });
            }
            filterConditions.push(eq(classes.status, status as typeof classStatusEnum.enumValues[number]));
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
            teacher: { ...getTableColumns(user) }
        }).from(classes)
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
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
        .where(eq(enrollments.classId, classId));

    res.status(200).json({data: {...classDetail, enrolledCount: Number(enrolledCountResult[0]?.count ?? 0)}});
})

export default router;
