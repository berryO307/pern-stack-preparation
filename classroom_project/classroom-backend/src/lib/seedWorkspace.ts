import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { departments, subjects, classes, enrollments, user } from "../db/schema/index.js";
import { randomUUID } from "crypto";

// The same fixture content every workspace gets, so the demo is predictable and
// reproducible rather than randomized per visitor. Teachers/students are a shared,
// workspace-agnostic pool of fixture identities (matched by email, reused across
// every workspace) - only departments/subjects/classes/enrollments are cloned
// fresh per workspace, since those are the rows workspace_id actually scopes.

const FIRST_NAMES = ["Ava", "Liam", "Noah", "Emma", "Olivia", "Mia", "Ethan", "Sophia", "Lucas", "Isabella", "Mason", "Amelia", "Logan", "Harper", "Elijah", "Evelyn", "James", "Abigail", "Benjamin", "Emily", "Henry", "Ella", "Jack", "Scarlett", "Owen"];
const LAST_NAMES = ["Carter", "Nguyen", "Patel", "Kim", "Garcia", "Rossi", "Muller", "Silva", "Johansson", "Dubois", "Khan", "Cohen", "Torres", "Ivanov", "Novak"];

const DEPARTMENT_DATA = [
    { code: "CS", name: "Computer Science", description: "Software, algorithms, and systems." },
    { code: "MATH", name: "Mathematics", description: "Pure and applied mathematics." },
    { code: "BUS", name: "Business Administration", description: "Management, finance, and strategy." },
];

const SUBJECT_DATA = [
    { code: "CS101", name: "Intro to Programming", dept: "CS", description: "Python fundamentals: syntax, control flow, functions." },
    { code: "CS201", name: "Data Structures", dept: "CS", description: "Lists, trees, graphs, and complexity analysis." },
    { code: "CS310", name: "Databases", dept: "CS", description: "Relational modeling, SQL, and transactions." },
    { code: "MATH110", name: "Calculus I", dept: "MATH", description: "Limits, derivatives, and integrals." },
    { code: "MATH220", name: "Linear Algebra", dept: "MATH", description: "Vector spaces, matrices, and eigenvalues." },
    { code: "BUS150", name: "Principles of Management", dept: "BUS", description: "Organizational theory and leadership." },
    { code: "BUS240", name: "Financial Accounting", dept: "BUS", description: "Financial statements and reporting." },
];

const CLASS_DATA = [
    { name: "Intro to Programming - Section A", subject: "CS101", capacity: 30 },
    { name: "Data Structures - Section A", subject: "CS201", capacity: 25 },
    { name: "Databases - Section A", subject: "CS310", capacity: 20 },
    { name: "Calculus I - Section A", subject: "MATH110", capacity: 35 },
    { name: "Linear Algebra - Section A", subject: "MATH220", capacity: 15 },
    { name: "Principles of Management - Section A", subject: "BUS150", capacity: 40 },
    { name: "Financial Accounting - Section A", subject: "BUS240", capacity: 10 },
];

// Deterministic per-class fill ratios so the seeded state is identical across
// workspaces, not random - low/medium/high/full fill levels for variety.
const FILL_RATIOS = [0.3, 0.6, 0.85, 0.5, 1, 0.4, 0.9];

export const seedWorkspace = async (workspaceId: string) => {
    const teachers = await upsertTeachers();
    const students = await upsertStudents();

    const depts: Record<string, number> = {};
    for (const d of DEPARTMENT_DATA) {
        const [created] = await db
            .insert(departments)
            .values({ workspaceId, code: d.code, name: d.name, description: d.description })
            .returning({ id: departments.id });
        depts[d.code] = created!.id;
    }

    const subjectIds: Record<string, number> = {};
    for (const s of SUBJECT_DATA) {
        const [created] = await db
            .insert(subjects)
            .values({ workspaceId, code: s.code, name: s.name, description: s.description, departmentId: depts[s.dept]! })
            .returning({ id: subjects.id });
        subjectIds[s.code] = created!.id;
    }

    const classIds: number[] = [];
    for (let i = 0; i < CLASS_DATA.length; i++) {
        const c = CLASS_DATA[i]!;
        const teacherId = teachers[i % teachers.length]!;
        const [created] = await db
            .insert(classes)
            .values({
                workspaceId,
                name: c.name,
                subjectId: subjectIds[c.subject]!,
                teacherId,
                capacity: c.capacity,
                description: `${c.name.split(" - ")[0]} for the current term.`,
                inviteCode: Math.random().toString(36).substring(2, 9),
                schedules: [],
            })
            .returning({ id: classes.id });
        classIds.push(created!.id);
    }

    for (let i = 0; i < classIds.length; i++) {
        const targetCount = Math.round(CLASS_DATA[i]!.capacity * FILL_RATIOS[i]!);
        const roster = shuffle(students).slice(0, targetCount);
        for (const studentId of roster) {
            const daysAgo = Math.floor(Math.random() * 30);
            const createdAt = new Date();
            createdAt.setDate(createdAt.getDate() - daysAgo);
            await db.insert(enrollments).values({ workspaceId, classId: classIds[i]!, studentId, createdAt });
        }
    }
};

// Global, workspace-agnostic fixture identities - matched by email and reused
// across every workspace's seed, not recreated each time.
async function upsertTeachers() {
    const names = ["Priya Sharma", "Daniel Reyes", "Wei Zhang", "Fatima Al-Sayed"];
    const ids: string[] = [];
    for (const name of names) {
        ids.push(await upsertFixtureUser(name, `${slugify(name)}@classroom.demo`, "teacher"));
    }
    return ids;
}

async function upsertStudents() {
    const ids: string[] = [];
    for (const first of FIRST_NAMES) {
        const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        const name = `${first} ${last}`;
        ids.push(await upsertFixtureUser(name, `${slugify(name)}@classroom.demo`, "student"));
    }
    return ids;
}

async function upsertFixtureUser(name: string, email: string, role: "teacher" | "student") {
    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (existing) return existing.id;

    const id = randomUUID();
    await db.insert(user).values({ id, name, email, role, emailVerified: true });
    return id;
}

function slugify(name: string) {
    return name.toLowerCase().replace(/[^a-z]+/g, ".");
}

function shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = copy[i]!;
        copy[i] = copy[j]!;
        copy[j] = temp;
    }
    return copy;
}
