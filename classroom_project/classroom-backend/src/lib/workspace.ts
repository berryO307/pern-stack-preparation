import { eq, sql } from "drizzle-orm";
import { randomInt } from "crypto";
import { db } from "../db/index.js";
import { demoWorkspaces } from "../db/schema/index.js";
import { seedWorkspace } from "./seedWorkspace.js";
import type { DemoWorkspace } from "../db/schema/index.js";

export const WORKSPACE_LIFETIME_MS = 60 * 60 * 1000;

const pgErrorCode = (e: any): string | undefined => e?.code ?? e?.cause?.code;

export type ResolvedWorkspace = DemoWorkspace & { wasJustProvisioned: boolean };

// A workspace row with seededAt still null means some earlier attempt at
// this exact provision (pre-dating the transaction below, or - even with
// it - a process crash between commit and this read is theoretically
// possible) never finished. Provisioning is idempotent and cheap to redo
// (see provisionWorkspace), so the correct move is always "throw this row
// away and provision fresh," never "serve it as-is" - a half-seeded
// workspace masquerading as real is worse than the extra few seconds a
// visitor waits for a clean one.
const isIncomplete = (ws: DemoWorkspace) => ws.seededAt === null;

// Returns the caller's current workspace, provisioning (and seeding) a fresh one
// if none exists yet, the previous one has expired, or it never finished
// seeding. Expired/incomplete workspaces are deleted outright - cascading to
// every domain table via workspace_id foreign keys - rather than flagged, so
// there's never more than one row per user and no separate "is this the
// active one" query is needed anywhere else. wasJustProvisioned distinguishes
// reuse from fresh creation, purely for the RUM workspace_provisioned event -
// it isn't used for any control flow.
// C4: lets the route decide whether this call is about to be a cheap reuse
// or an actual provision BEFORE spending rate-limit budget on it - see
// middleware/workspaceProvisionRateLimit.ts's checkProvisionRateLimit,
// called only when this returns false. A read-only duplicate of
// resolveWorkspace's own existence check, not the check itself, so a
// legitimate user can never be locked out by a handful of calls that were
// all just fetching the workspace they already have.
export const hasValidWorkspace = async (userId: string): Promise<boolean> => {
    const [existing] = await db.select().from(demoWorkspaces).where(eq(demoWorkspaces.userId, userId));
    return !!existing && !isIncomplete(existing) && (existing.isPermanent || existing.expiresAt > new Date());
};

export const resolveWorkspace = async (userId: string, isAdmin: boolean): Promise<ResolvedWorkspace> => {
    const [existing] = await db.select().from(demoWorkspaces).where(eq(demoWorkspaces.userId, userId));

    if (existing) {
        if (!isIncomplete(existing) && (existing.isPermanent || existing.expiresAt > new Date())) {
            return { ...existing, wasJustProvisioned: false };
        }
        if (isIncomplete(existing)) {
            console.warn(`Workspace ${existing.id} (user ${userId}) has seededAt=null - re-provisioning transparently`);
        }
        await db.delete(demoWorkspaces).where(eq(demoWorkspaces.id, existing.id));
    }

    return provisionWorkspace(userId, isAdmin);
};

const provisionWorkspace = async (userId: string, isAdmin: boolean): Promise<ResolvedWorkspace> => {
    // Admin's workspace is flagged permanent and given a far-future expiresAt
    // for display purposes only - isPermanent is what actually exempts it from
    // both the lazy expiry check above and the sweep job, not this value.
    const expiresAt = isAdmin
        ? new Date("2099-12-31T00:00:00.000Z")
        : new Date(Date.now() + WORKSPACE_LIFETIME_MS);

    const startedAt = Date.now();
    try {
        // The whole provision - the workspace row, every seed table, and
        // seededAt itself - is one transaction. Any exception (a bad seed
        // plan, a DB error, anything) rolls back everything: a workspace
        // either fully exists or was never created, with nothing in
        // between for a concurrent reader to ever observe. Before this,
        // the workspace row committed on its own INSERT, seedWorkspace's
        // ~950 inserts each committed independently as they ran, and
        // seededAt was set in a final, separate UPDATE - so a mid-seed
        // exception (or just a concurrent request reading the row while an
        // in-progress seed hadn't reached every table yet) could and did
        // leave a permanently-partial workspace behind, since nothing ever
        // retried it.
        const result = await db.transaction(async (tx) => {
            const [created] = await tx
                .insert(demoWorkspaces)
                .values({ userId, isPermanent: isAdmin, expiresAt })
                .returning();

            if (!created) throw new Error("Workspace insert returned no row");

            // Generated independently of faker's own RNG (crypto, not
            // faker.number.int) so the seed itself doesn't depend on faker's
            // internal state - it's what makes this workspace's data
            // reproducible, and what a reset regenerates fresh. seedWorkspace
            // may return a different seed than it was given if this one
            // failed a sanity check and it retried - the returned value is
            // the one to persist/log.
            const initialSeed = randomInt(0, 2 ** 31 - 1);
            const seedValue = await seedWorkspace(tx, created.id, initialSeed);

            // Written last, inside the same transaction: this is the
            // completion marker isIncomplete() above checks for. It can
            // only ever be non-null on a row that also has every seed
            // table fully populated, because both landed in the same
            // atomic commit.
            const [seeded] = await tx
                .update(demoWorkspaces)
                .set({ seededAt: new Date(), seedValue })
                .where(eq(demoWorkspaces.id, created.id))
                .returning();

            return seeded!;
        });

        console.log(
            `[workspace] provisioned ${result.id} for user ${userId} in ${Date.now() - startedAt}ms, seed=${result.seedValue}`
        );
        return { ...result, wasJustProvisioned: true };
    } catch (e: any) {
        // Unique violation on user_id: a concurrent request from the same user
        // (e.g. two tabs, or two of the several requests a fresh page load
        // fires in parallel) already provisioned one. Because provisioning is
        // now transactional, this reader either sees nothing yet (the winner's
        // transaction hasn't committed - the INSERT below blocks until it
        // does, then this catch fires) or the winner's fully-seeded row - never
        // a partial one.
        if (pgErrorCode(e) === "23505") {
            const [existing] = await db.select().from(demoWorkspaces).where(eq(demoWorkspaces.userId, userId));
            if (existing && !isIncomplete(existing)) return { ...existing, wasJustProvisioned: false };
        }
        console.error(`[workspace] provisioning failed for user ${userId} after ${Date.now() - startedAt}ms`, e);
        throw e;
    }
};

// D1 invariants, run against an already-seeded workspace. Used by the health
// endpoint (routes/dashboard.ts) and by the self-healing/backfill paths - one
// implementation, not three copies that can drift.
export type WorkspaceInvariantResult = { name: string; pass: boolean; detail: string };

export const checkWorkspaceInvariants = async (workspaceId: string): Promise<WorkspaceInvariantResult[]> => {
    const results: WorkspaceInvariantResult[] = [];
    const push = (name: string, pass: boolean, detail: string) => results.push({ name, pass, detail });

    const [row] = await db
        .select({ seededAt: demoWorkspaces.seededAt })
        .from(demoWorkspaces)
        .where(eq(demoWorkspaces.id, workspaceId));
    push("seeded", !!row?.seededAt, row?.seededAt ? `seeded at ${row.seededAt.toISOString()}` : "seededAt is null");

    const counts = await db.execute<{ table: string; n: string; future_n: string }>(sql`
        select 'departments' as table, count(*) as n, count(*) filter (where created_at > now()) as future_n from departments where workspace_id = ${workspaceId}
        union all
        select 'subjects', count(*), count(*) filter (where created_at > now()) from subjects where workspace_id = ${workspaceId}
        union all
        select 'classes', count(*), count(*) filter (where created_at > now()) from classes where workspace_id = ${workspaceId}
        union all
        select 'enrollments', count(*), count(*) filter (where created_at > now()) from enrollments where workspace_id = ${workspaceId}
    `);
    for (const row of counts.rows) {
        push(`${row.table}_nonempty`, Number(row.n) > 0, `${row.n} row(s)`);
        push(`${row.table}_not_future`, Number(row.future_n) === 0, `${row.future_n} future-dated row(s)`);
    }

    const buckets = await db.execute<{ bucket: string; n: string }>(sql`
        select
          case
            when active::float / nullif(capacity, 0) > 0.8 then '81-100'
            when active::float / nullif(capacity, 0) > 0.6 then '61-80'
            when active::float / nullif(capacity, 0) > 0.4 then '41-60'
            when active::float / nullif(capacity, 0) > 0.2 then '21-40'
            else '0-20'
          end as bucket,
          count(*) as n
        from (
          select c.id, c.capacity, count(e.id) filter (where e.status = 'active') as active
          from classes c
          left join enrollments e on e.class_id = c.id
          where c.workspace_id = ${workspaceId}
          group by c.id, c.capacity
        ) t
        group by bucket
    `);
    push("all_capacity_buckets_nonempty", buckets.rows.length === 5, `${buckets.rows.length}/5 buckets populated`);

    const months = await db.execute<{ n: string }>(sql`
        select count(distinct date_trunc('month', created_at)) as n
        from enrollments where workspace_id = ${workspaceId} and created_at > now() - interval '12 months'
    `);
    const monthCount = Number(months.rows[0]?.n ?? 0);
    push("twelve_months_covered", monthCount >= 12, `${monthCount}/12 trailing months have an enrollment`);

    const kpis = await db.execute<{ students: string; faculty: string; classes: string; subjects: string }>(sql`
        select
          (select count(distinct student_id) from enrollments where workspace_id = ${workspaceId}) as students,
          (select count(distinct teacher_id) from classes where workspace_id = ${workspaceId}) as faculty,
          (select count(*) from classes where workspace_id = ${workspaceId}) as classes,
          (select count(*) from subjects where workspace_id = ${workspaceId}) as subjects
    `);
    const k = kpis.rows[0];
    const kpiValues = k ? [Number(k.students), Number(k.faculty), Number(k.classes), Number(k.subjects)] : [];
    push(
        "kpis_distinct",
        new Set(kpiValues).size === kpiValues.length,
        `students=${k?.students} faculty=${k?.faculty} classes=${k?.classes} subjects=${k?.subjects}`
    );

    const nullScope = await db.execute<{ n: string }>(sql`
        select
          (select count(*) from departments where workspace_id is null) +
          (select count(*) from subjects where workspace_id is null) +
          (select count(*) from classes where workspace_id is null) +
          (select count(*) from enrollments where workspace_id is null) as n
    `);
    push("no_null_workspace_id_globally", Number(nullScope.rows[0]?.n ?? 1) === 0, `${nullScope.rows[0]?.n} row(s) with null workspace_id`);

    return results;
};

export const isWorkspaceHealthy = (results: WorkspaceInvariantResult[]) => results.every((r) => r.pass);
