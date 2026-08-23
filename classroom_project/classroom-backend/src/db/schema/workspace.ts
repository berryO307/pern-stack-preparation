import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth.js";

export const demoWorkspaces = pgTable('demo_workspaces', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    // True only for the site owner's own workspace (see ADMIN_EMAILS in lib/auth.ts) -
    // excluded from both the lazy per-request expiry check and the daily sweep, so it
    // never gets torn down and reseeded like a visitor's.
    isPermanent: boolean('is_permanent').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    seededAt: timestamp('seeded_at'),
    // Passed to faker.seed() when generating this workspace's fixture data -
    // logged at provision time so any data-shaped bug can be replayed exactly
    // by re-seeding with the same value, even though the data itself looks
    // randomized to a visitor.
    seedValue: integer('seed_value'),
}, (table) => [
    // A user has at most one workspace row at a time - an expired one is deleted
    // (not flagged) before/when a new one is provisioned, so a plain unique
    // constraint is sufficient. Deliberately not a partial index filtered on
    // "expires_at > now()": now() is stable, not immutable, and Postgres rejects
    // non-immutable expressions in an index predicate.
    uniqueIndex('demo_workspaces_user_id_unique').on(table.userId),
]);

export const demoWorkspacesRelations = relations(demoWorkspaces, ({ one }) => ({
    user: one(user, {
        fields: [demoWorkspaces.userId],
        references: [user.id],
    }),
}));

export type DemoWorkspace = typeof demoWorkspaces.$inferSelect;
export type NewDemoWorkspace = typeof demoWorkspaces.$inferInsert;
