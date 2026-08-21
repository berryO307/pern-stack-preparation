import "dotenv/config";
import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "./db/index.js";
import { account, departments, subjects, classes, enrollments, user } from "./db/schema/index.js";

// Populates the site with permanent, admin-owned demo data (createdBy stays null, so the
// guest-cleanup sweep never touches it) and creates the one real admin account this project
// has - everyone else signs in as a guest. Safe to re-run: existing rows are matched by their
// natural unique key (email/code) and left alone.

const FIRST_NAMES = ["Ava", "Liam", "Noah", "Emma", "Olivia", "Mia", "Ethan", "Sophia", "Lucas", "Isabella", "Mason", "Amelia", "Logan", "Harper", "Elijah", "Evelyn", "James", "Abigail", "Benjamin", "Emily", "Henry", "Ella", "Jack", "Scarlett", "Owen"];
const LAST_NAMES = ["Carter", "Nguyen", "Patel", "Kim", "Garcia", "Rossi", "Muller", "Silva", "Johansson", "Dubois", "Khan", "Cohen", "Torres", "Ivanov", "Novak"];

async function main() {
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
        throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD before running the seed script");
    }

    const admin = await upsertAdmin(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
    const teachers = await upsertTeachers();
    const students = await upsertStudents();

    const deptData = [
        { code: "CS", name: "Computer Science", description: "Software, algorithms, and systems." },
        { code: "MATH", name: "Mathematics", description: "Pure and applied mathematics." },
        { code: "BUS", name: "Business Administration", description: "Management, finance, and strategy." },
    ];
    const depts: Record<string, number> = {};
    for (const d of deptData) {
        depts[d.code] = await upsertDepartment(d);
    }

    const subjectData = [
        { code: "CS101", name: "Intro to Programming", dept: "CS", description: "Python fundamentals: syntax, control flow, functions." },
        { code: "CS201", name: "Data Structures", dept: "CS", description: "Lists, trees, graphs, and complexity analysis." },
        { code: "CS310", name: "Databases", dept: "CS", description: "Relational modeling, SQL, and transactions." },
        { code: "MATH110", name: "Calculus I", dept: "MATH", description: "Limits, derivatives, and integrals." },
        { code: "MATH220", name: "Linear Algebra", dept: "MATH", description: "Vector spaces, matrices, and eigenvalues." },
        { code: "BUS150", name: "Principles of Management", dept: "BUS", description: "Organizational theory and leadership." },
        { code: "BUS240", name: "Financial Accounting", dept: "BUS", description: "Financial statements and reporting." },
    ];
    const subjectIds: Record<string, number> = {};
    for (const s of subjectData) {
        subjectIds[s.code] = await upsertSubject({ code: s.code, name: s.name, description: s.description, departmentId: depts[s.dept]! });
    }

    const classData = [
        { name: "Intro to Programming - Section A", subject: "CS101", capacity: 30 },
        { name: "Data Structures - Section A", subject: "CS201", capacity: 25 },
        { name: "Databases - Section A", subject: "CS310", capacity: 20 },
        { name: "Calculus I - Section A", subject: "MATH110", capacity: 35 },
        { name: "Linear Algebra - Section A", subject: "MATH220", capacity: 15 },
        { name: "Principles of Management - Section A", subject: "BUS150", capacity: 40 },
        { name: "Financial Accounting - Section A", subject: "BUS240", capacity: 10 },
    ];
    const classIds: number[] = [];
    for (let i = 0; i < classData.length; i++) {
        const c = classData[i]!;
        const teacherId = teachers[i % teachers.length]!;
        const id = await upsertClass({
            name: c.name,
            subjectId: subjectIds[c.subject]!,
            teacherId,
            capacity: c.capacity,
            description: `${c.name.split(" - ")[0]} for the current term.`,
        });
        classIds.push(id);
    }

    // Enroll students at varied fill levels (some low, some near-full, one at capacity),
    // spread over the last 30 days so the dashboard's enrollment trend isn't flat.
    const fillRatios = [0.3, 0.6, 0.85, 0.5, 1, 0.4, 0.9];
    for (let i = 0; i < classIds.length; i++) {
        const targetCount = Math.round(classData[i]!.capacity * fillRatios[i]!);
        const roster = shuffle(students).slice(0, targetCount);
        for (const studentId of roster) {
            const daysAgo = Math.floor(Math.random() * 30);
            await upsertEnrollment(classIds[i]!, studentId, daysAgo);
        }
    }

    console.log("Seed complete.");
    console.log(`Admin login: ${process.env.ADMIN_EMAIL}`);
    process.exit(0);
}

async function upsertAdmin(email: string, password: string) {
    const [existing] = await db.select().from(user).where(eq(user.email, email));
    if (existing) return existing.id;

    const id = randomUUID();
    await db.insert(user).values({ id, name: "Admin", email, emailVerified: true, role: "admin" });

    const hashed = await hashPassword(password);
    await db.insert(account).values({
        id: randomUUID(),
        userId: id,
        accountId: id,
        providerId: "credential",
        password: hashed,
    });

    return id;
}

async function upsertTeachers() {
    const names = ["Priya Sharma", "Daniel Reyes", "Wei Zhang", "Fatima Al-Sayed"];
    const ids: string[] = [];
    for (const name of names) {
        const email = `${slugify(name)}@classroom.demo`;
        ids.push(await upsertUser(name, email, "teacher"));
    }
    return ids;
}

async function upsertStudents() {
    const ids: string[] = [];
    for (const first of FIRST_NAMES) {
        const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        const name = `${first} ${last}`;
        const email = `${slugify(name)}@classroom.demo`;
        ids.push(await upsertUser(name, email, "student"));
    }
    return ids;
}

async function upsertUser(name: string, email: string, role: "teacher" | "student") {
    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (existing) return existing.id;

    const id = randomUUID();
    await db.insert(user).values({ id, name, email, role, emailVerified: true });
    return id;
}

async function upsertDepartment(d: { code: string; name: string; description: string }) {
    const [existing] = await db.select({ id: departments.id }).from(departments).where(eq(departments.code, d.code));
    if (existing) return existing.id;

    const [created] = await db.insert(departments).values(d).returning({ id: departments.id });
    return created!.id;
}

async function upsertSubject(s: { code: string; name: string; description: string; departmentId: number }) {
    const [existing] = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, s.code));
    if (existing) return existing.id;

    const [created] = await db.insert(subjects).values(s).returning({ id: subjects.id });
    return created!.id;
}

async function upsertClass(c: { name: string; subjectId: number; teacherId: string; capacity: number; description: string }) {
    const [existing] = await db.select({ id: classes.id }).from(classes).where(eq(classes.name, c.name));
    if (existing) return existing.id;

    const [created] = await db
        .insert(classes)
        .values({ ...c, inviteCode: Math.random().toString(36).substring(2, 9), schedules: [] })
        .returning({ id: classes.id });
    return created!.id;
}

async function upsertEnrollment(classId: number, studentId: string, daysAgo: number) {
    const [existing] = await db
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(sql`${enrollments.classId} = ${classId} AND ${enrollments.studentId} = ${studentId}`);
    if (existing) return;

    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);
    await db.insert(enrollments).values({ classId, studentId, createdAt });
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

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
