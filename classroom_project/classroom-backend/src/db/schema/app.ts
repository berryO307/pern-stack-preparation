import {check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar} from "drizzle-orm/pg-core";
import {relations, sql} from "drizzle-orm";
import {user} from "./auth.js";
import {demoWorkspaces} from "./workspace.js";

const timestamps = {
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull()
}

export type ClassSchedule = {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
};

export const classStatusEnum = pgEnum('class_status', ['active', 'inactive', 'archived']);
export const enrollmentStatusEnum = pgEnum('enrollment_status', ['active', 'waitlisted', 'dropped']);
// Every visitor-writable table carries this. The fixture generator is the only
// writer of 'seed'; every app write path leaves it at its default ('user') -
// so a write path that forgets to think about origin still fails safe
// (flushable), rather than silently becoming permanent. Never accept this
// value from a request body - see routes/*.ts, which all build insert values
// from an explicit field list rather than spreading req.body, so a client
// can't smuggle 'seed' in to make a row un-flushable.
export const originEnum = pgEnum('origin', ['seed', 'user']);

export const departments = pgTable('departments', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    // Every row belongs to exactly one demo workspace (including the admin's
    // permanent one) - deleting the workspace cascades here. Uniqueness on
    // `code` is scoped per-workspace, not global, since every workspace gets
    // its own independent copy of the same fixture codes.
    workspaceId: uuid('workspace_id').notNull().references(() => demoWorkspaces.id, { onDelete: 'cascade' }),
    code: varchar('code', {length: 50}).notNull(),
    name: varchar('name', {length:255}).notNull(),
    description: varchar('description', {length: 255}),
    origin: originEnum('origin').notNull().default('user'),
    ...timestamps
}, (table) => [
    index('departments_created_at_idx').on(table.createdAt),
    index('departments_workspace_id_idx').on(table.workspaceId),
    index('departments_workspace_id_origin_idx').on(table.workspaceId, table.origin),
    uniqueIndex('departments_workspace_id_code_unique').on(table.workspaceId, table.code),
]);

export const subjects = pgTable('subjects', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    departmentId: integer('department_id').notNull().references(() => departments.id, { onDelete: 'restrict' }),
    workspaceId: uuid('workspace_id').notNull().references(() => demoWorkspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', {length:255}).notNull(),
    code: varchar('code', {length: 50}).notNull(),
    description: varchar('description', {length: 255}),
    origin: originEnum('origin').notNull().default('user'),
    ...timestamps
}, (table) => [
    index('subjects_created_at_idx').on(table.createdAt),
    index('subjects_department_id_idx').on(table.departmentId),
    index('subjects_workspace_id_idx').on(table.workspaceId),
    index('subjects_workspace_id_origin_idx').on(table.workspaceId, table.origin),
    uniqueIndex('subjects_workspace_id_code_unique').on(table.workspaceId, table.code),
]);

export const classes = pgTable('classes', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
    // Fixture/real users, shared across every workspace - not itself workspace-scoped.
    teacherId: text('teacher_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
    workspaceId: uuid('workspace_id').notNull().references(() => demoWorkspaces.id, { onDelete: 'cascade' }),
    inviteCode: varchar('invite_code', {length: 50}).notNull(),
    name: varchar('name', {length: 255}).notNull(),
    bannerCldPubId: text('banner_cld_pub_id'),
    bannerUrl: text('banner_url'),
    description: text('description'),
    capacity: integer('capacity').notNull().default(50),
    status: classStatusEnum('status').notNull().default('active'),
    schedules: jsonb('schedules').$type<ClassSchedule[]>(),
    origin: originEnum('origin').notNull().default('user'),
    ...timestamps
}, (table) => [
    index('classes_subject_id_idx').on(table.subjectId),
    index('classes_teacher_id_idx').on(table.teacherId),
    index('classes_created_at_idx').on(table.createdAt),
    index('classes_workspace_id_idx').on(table.workspaceId),
    index('classes_workspace_id_origin_idx').on(table.workspaceId, table.origin),
    uniqueIndex('classes_workspace_id_invite_code_unique').on(table.workspaceId, table.inviteCode),
    check('classes_capacity_non_negative', sql`${table.capacity} >= 0`),
    // Enforced in the DB, not just by generateInviteCode() - the app-level
    // generator is the only writer today, but the constraint is what
    // actually guarantees the format can't drift regardless of caller.
    check('classes_invite_code_format', sql`${table.inviteCode} ~ '^[A-Z]{3}[0-9]{3}$'`),
]);

export const enrollments = pgTable('enrollments', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    // Fixture/real users, shared across every workspace - not itself workspace-scoped.
    studentId: text('student_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => demoWorkspaces.id, { onDelete: 'cascade' }),
    // Only 'active' rows occupy a seat - capacity/fill-rate queries filter on
    // this. Self-enrollment (routes/enrollments.ts) always creates 'active'
    // rows; 'waitlisted'/'dropped' only appear in seeded fixture data today.
    status: enrollmentStatusEnum('status').notNull().default('active'),
    origin: originEnum('origin').notNull().default('user'),
    ...timestamps
}, (table) => [
    // classId is already a specific workspace's row, so this pair is unique
    // without needing workspaceId in the constraint too.
    uniqueIndex('enrollments_student_id_class_id_unique').on(table.studentId, table.classId),
    index('enrollments_student_id_idx').on(table.studentId),
    index('enrollments_class_id_idx').on(table.classId),
    index('enrollments_created_at_idx').on(table.createdAt),
    index('enrollments_workspace_id_idx').on(table.workspaceId),
    index('enrollments_workspace_id_origin_idx').on(table.workspaceId, table.origin),
    // Analog of the class_id+status composite the summary endpoint would want —
    // this schema has no enrollment status column, so class_id+created_at is the
    // pairing that actually serves the per-class, date-bounded counts it runs.
    index('enrollments_class_id_created_at_idx').on(table.classId, table.createdAt),
]);

export const departmentRelations = relations(departments, ({ many }) => ({ subjects: many(subjects) }));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
    department: one(departments, {
        fields: [subjects.departmentId],
        references: [departments.id],
    }),
    classes: many(classes)
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
    subject: one(subjects, {
        fields: [classes.subjectId],
        references: [subjects.id],
    }),
    teacher: one(user, {
        fields: [classes.teacherId],
        references: [user.id],
    }),
    enrollments: many(enrollments)
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
    student: one(user, {
        fields: [enrollments.studentId],
        references: [user.id],
    }),
    class: one(classes, {
        fields: [enrollments.classId],
        references: [classes.id],
    })
}));

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;

export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;

export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
