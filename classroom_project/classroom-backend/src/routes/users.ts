import express from "express";
import {roleEnum, user} from "../db/schema/index.js";
import {and, desc, eq, getTableColumns, ilike, or, sql} from "drizzle-orm";
import {db} from "../db/index.js";
const router = express.Router();

// Get all users switch optional search, role filtering and pagination
router.get("/", async (req, res) => {
    try {
        const { search, role, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;
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
            filterConditions.push(eq(user.role, String(role) as typeof roleEnum.enumValues[number]));
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
            .orderBy(desc(user.createdAt))
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

export default router;
