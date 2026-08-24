import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { db as Db } from "../db/index.js";
import { departments, subjects, classes, enrollments, user, demoWorkspaces } from "../db/schema/index.js";
import { randomUUID } from "crypto";
import { faker } from "@faker-js/faker";

// The caller (lib/workspace.ts) passes its own open transaction, not the
// module-level `db` - every insert this file makes has to land inside that
// SAME transaction, or none of it is actually atomic with the workspace row
// and the seededAt marker. A transaction object doesn't structurally match
// `typeof db` exactly (it lacks the pool-only `$client` property), so this
// is a union of both - a script calling seedWorkspace directly against the
// top-level `db` (outside any transaction, e.g. a one-off repair) and
// lib/workspace.ts's `tx` both need to pass here interchangeably.
type DbOrTx = typeof Db | Parameters<Parameters<typeof Db.transaction>[0]>[0];

// ---- Global, workspace-agnostic fixture identities -------------------------
// Teachers/students are a shared pool reused across every workspace (matched by
// email in upsertFixtureUsers below). The pool is built ONCE at module load with
// a fixed seed of its own, independent of any workspace's seed - if pool names
// changed per workspace, every re-seed would mint a fresh set of "unique" emails
// and permanently leak orphaned user rows, since fixture users are global and
// never swept. Per-workspace variety instead comes from which subset of this
// fixed pool gets enrolled, in what statuses, and on what backdated schedule -
// see generateSeedPlan. Pool size has to comfortably exceed the largest single
// class's roster (active + waitlisted + dropped) since a class can't reuse a
// student twice, though the same student can enroll across different classes.
const NAME_POOL_SEED = 42;
const STUDENT_POOL_SIZE = 140;
// Deliberately LESS than the catalog's own class count (21), never equal to
// it: the round-robin teacher-to-class assignment below needs
// teacherCount <= classCount for every teacher to land a real class (and
// therefore a real Department, rather than "—"), but teacherCount ==
// classCount was tried first and makes the "classes" and "faculty" KPI
// numbers structurally identical every time - not a rare collision a seed
// retry can fix, a permanent one, since both would always be equal. 13 keeps
// every teacher assigned (several teach more than one class) while keeping
// classes != faculty != subjects (16 subjects, 13 faculty, 21 classes).
const TEACHER_POOL_SIZE = 13;

// firstName + lastName, not faker.person.fullName() - fullName() randomly
// mints a prefix ("Dr.", "Mrs.") and/or suffix ("DVM", "PhD") per locale
// data, which reads as an obvious generator artifact once several fixture
// people sit in the same table (one plain "Cleo Zemlak" next to "Taurean
// Mertz DVM"). One clean convention, no credential noise.
const buildNamePool = (size: number, poolSeed: number): string[] => {
    faker.seed(poolSeed);
    const names = new Set<string>();
    while (names.size < size) names.add(`${faker.person.firstName()} ${faker.person.lastName()}`);
    return [...names];
};

const STUDENT_NAMES = buildNamePool(STUDENT_POOL_SIZE, NAME_POOL_SEED);
const TEACHER_NAMES = buildNamePool(TEACHER_POOL_SIZE, NAME_POOL_SEED + 1);

const slugify = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, ".");
// Reserved, non-routable domain - never a real institution's - so seeded
// fixture emails can never collide with or be mistaken for a live address.
const fixtureEmail = (name: string) => `${slugify(name)}@example.edu`;

// DiceBear is a dedicated, open-source avatar-generation service (MIT-
// licensed, no API key, no real person's likeness) - not a random photo
// hotlinked from search results, which is what the "URL rot / unclear
// licensing" concern about placeholder avatars is actually about. Seeding on
// email (already stable and unique per fixture person) makes every fixture
// person's avatar deterministic and reproducible, matching how the rest of
// this seed data works - the same person always gets the same illustrated
// avatar across every reseed.
const buildFixtureAvatarUrl = (seed: string): string =>
    `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}&radius=50`;

// ---- Department / subject catalog ------------------------------------------
// Unequal sizes by design (one large, two mid, one small department, counted
// by how many classes they end up with below) so the dashboard's department
// breakdown isn't uniform.
type SubjectDef = { code: string; name: string; description: string };
type DepartmentDef = { code: string; name: string; description: string; subjects: SubjectDef[] };

const DEPARTMENT_CATALOG: DepartmentDef[] = [
    {
        code: "CS", name: "Computer Science", description: "Software, algorithms, and systems.",
        subjects: [
            { code: "CS101", name: "Intro to Programming", description: "Python fundamentals: syntax, control flow, functions." },
            { code: "CS201", name: "Data Structures", description: "Lists, trees, graphs, and complexity analysis." },
            { code: "CS310", name: "Databases", description: "Relational modeling, SQL, and transactions." },
            { code: "CS410", name: "Machine Learning", description: "Supervised learning, model evaluation, and applications." },
            { code: "CS250", name: "Computer Networks", description: "Protocols, routing, and network architecture." },
        ],
    },
    {
        code: "MATH", name: "Mathematics", description: "Pure and applied mathematics.",
        subjects: [
            { code: "MATH110", name: "Calculus I", description: "Limits, derivatives, and integrals." },
            { code: "MATH220", name: "Linear Algebra", description: "Vector spaces, matrices, and eigenvalues." },
            { code: "MATH310", name: "Probability & Statistics", description: "Distributions, inference, and hypothesis testing." },
        ],
    },
    {
        code: "BUS", name: "Business Administration", description: "Management, finance, and strategy.",
        subjects: [
            { code: "BUS150", name: "Principles of Management", description: "Organizational theory and leadership." },
            { code: "BUS240", name: "Financial Accounting", description: "Financial statements and reporting." },
            { code: "BUS310", name: "Marketing Fundamentals", description: "Market research, positioning, and branding." },
        ],
    },
    {
        code: "ART", name: "Fine Arts", description: "Studio practice and visual culture.",
        subjects: [
            { code: "ART105", name: "Studio Foundations", description: "Drawing, composition, and materials." },
        ],
    },
    {
        code: "PHYS", name: "Physics", description: "Matter, energy, and the laws that govern them.",
        subjects: [
            { code: "PHYS101", name: "Introduction to Physics", description: "Mechanics, motion, and the fundamentals of force." },
            { code: "PHYS210", name: "Electromagnetism", description: "Electric fields, circuits, and magnetic forces." },
        ],
    },
    {
        code: "PSY", name: "Psychology", description: "Mind, behavior, and cognition.",
        subjects: [
            { code: "PSY101", name: "Introduction to Psychology", description: "Behavior, mind, and the foundations of psychological science." },
            { code: "PSY220", name: "Cognitive Psychology", description: "Memory, perception, and decision-making." },
        ],
    },
    // Deliberately empty - gives the Departments "Has subjects" filter (and
    // its show page's empty state) a real case to demonstrate, not just a
    // hypothetical one.
    {
        code: "ENV", name: "Environmental Science", description: "Sustainability, ecosystems, and environmental policy.",
        subjects: [],
    },
];

// ---- Section layout ----------------------------------------------------
// Most subjects get one lecture section; the two intro CS courses and the
// management course also get a lab/seminar, so class names aren't all
// identically-shaped "X - Section A" rows. A handful of single-section
// subjects also get a suffix other than "Section A" - not because they have
// a second section, but so the catalog doesn't read as one suffix
// mechanically repeated down every row without an actual lab/seminar to
// justify it.
type SectionKind = { suffix: string; capacityRange: [number, number] };
const LECTURE_A: SectionKind = { suffix: "Section A", capacityRange: [70, 120] };
const SINGLE_SECTION: SectionKind = { suffix: "Section A", capacityRange: [45, 90] };
const LAB: SectionKind = { suffix: "Lab", capacityRange: [20, 32] };
const SEMINAR: SectionKind = { suffix: "Seminar", capacityRange: [20, 35] };
const STUDIO: SectionKind = { suffix: "Studio", capacityRange: [45, 90] };
const EVENING: SectionKind = { suffix: "Evening", capacityRange: [45, 90] };
const HONOURS: SectionKind = { suffix: "Honours", capacityRange: [45, 90] };

const sectionsFor = (subjectCode: string): SectionKind[] => {
    if (subjectCode === "CS101" || subjectCode === "CS201" || subjectCode === "CS410") return [LECTURE_A, LAB];
    if (subjectCode === "BUS150" || subjectCode === "BUS240") return [LECTURE_A, SEMINAR];
    if (subjectCode === "ART105") return [STUDIO];
    if (subjectCode === "PSY220") return [EVENING];
    if (subjectCode === "MATH310") return [HONOURS];
    return [SINGLE_SECTION];
};

// ---- Fill-rate targets --------------------------------------------------
// One target ratio (active enrolled / capacity) per class, in catalog order,
// hand-tuned rather than randomly rolled so every one of the dashboard's five
// fill-rate buckets (0-20/21-40/41-60/61-80/81-100%, see routes/dashboard.ts's
// capacity_bucketed CTE) is always non-empty and the overall skew matches the
// brief (most 55-90%, a couple nearly empty, one at capacity). Length must
// match the total class count produced by DEPARTMENT_CATALOG + sectionsFor
// (21 today) - assertSeedPlanSanity below catches a mismatch either way.
const FILL_TARGETS = [
    0.05, 0.15, 0.28, 0.42, 0.5, 0.58, 0.62, 0.65, 0.68, 0.72, 0.76, 0.6, 0.66, 0.7, 0.74, 0.83, 1.0,
    0.58, 0.7, 0.64, 0.48,
];

// ---- Invite codes --------------------------------------------------------
// Seeded classes get their own in-memory generator (rather than
// lib/inviteCode.ts's DB-backed one) so the whole plan - codes included - is
// reproducible purely from the workspace seed, with no DB round trips before
// the plan is validated.
const CODE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CODE_DIGITS = "0123456789";

const planInviteCode = (used: Set<string>): string => {
    for (let attempt = 0; attempt < 20; attempt++) {
        const candidate =
            Array.from({ length: 3 }, () => faker.helpers.arrayElement([...CODE_LETTERS])).join("") +
            Array.from({ length: 3 }, () => faker.helpers.arrayElement([...CODE_DIGITS])).join("");
        if (!used.has(candidate)) {
            used.add(candidate);
            return candidate;
        }
    }
    throw new Error("Failed to generate a unique seeded invite code");
};

// ---- Enrollment timestamps -----------------------------------------------
// Term-start clustering: enrollment activity clusters around January and
// September intakes (and ramps up the month before), not spread uniformly.
const TERM_START_MONTHS = new Set([0, 8]); // Jan, Sep

type MonthWindow = { start: Date; end: Date; weight: number };

const buildMonthWindows = (referenceNow: Date): MonthWindow[] => {
    // 12 trailing windows: index 0 = current (partial) month back to index 11
    // = 11 months ago.
    const windows: MonthWindow[] = [];
    for (let m = 0; m < 12; m++) {
        const start = new Date(Date.UTC(referenceNow.getUTCFullYear(), referenceNow.getUTCMonth() - m, 1));
        const end = m === 0 ? referenceNow : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1) - 1);
        const isTermStart = TERM_START_MONTHS.has(start.getUTCMonth());
        const isPreTerm = TERM_START_MONTHS.has((start.getUTCMonth() + 1) % 12);
        windows.push({ start, end, weight: isTermStart ? 6 : isPreTerm ? 3 : 1 });
    }
    return windows;
};

// Weekday-weighted: mostly Mon-Fri timestamps, with a slim allowance for
// weekends so the distribution doesn't look artificially clipped.
const pickWeekdayLeaningDate = (start: Date, end: Date): Date => {
    for (let attempt = 0; attempt < 8; attempt++) {
        const candidate = faker.date.between({ from: start, to: end });
        const day = candidate.getUTCDay();
        const isWeekend = day === 0 || day === 6;
        if (!isWeekend || faker.number.float({ min: 0, max: 1 }) < 0.15) return candidate;
    }
    return faker.date.between({ from: start, to: end });
};

// ---- Plan generation ------------------------------------------------------
type ClassStatus = "active" | "inactive" | "archived";

// Mostly active, a few inactive, one or two archived - a status column
// where every value is identical is dead weight on the list page.
const CLASS_STATUS_WEIGHTS: { value: ClassStatus; weight: number }[] = [
    { value: "active", weight: 82 },
    { value: "inactive", weight: 13 },
    { value: "archived", weight: 5 },
];

type PlanClass = {
    departmentCode: string;
    subjectCode: string;
    name: string;
    capacity: number;
    inviteCode: string;
    teacherIndex: number;
    fillTarget: number;
    status: ClassStatus;
    createdAt: Date;
};

type EnrollmentStatus = "active" | "waitlisted" | "dropped";
type PlanEnrollment = { classIndex: number; studentIndex: number; status: EnrollmentStatus; createdAt: Date };

type SeedPlan = { seed: number; classesPlan: PlanClass[]; enrollmentsPlan: PlanEnrollment[] };

// Mirrors routes/dashboard.ts's capacity_bucketed CTE thresholds exactly, so
// this check means what the dashboard will actually render.
const fillBucket = (ratio: number): string =>
    ratio > 0.8 ? "81-100" : ratio > 0.6 ? "61-80" : ratio > 0.4 ? "41-60" : ratio > 0.2 ? "21-40" : "0-20";

const assertSeedPlanSanity = (classesPlan: PlanClass[], enrollmentsPlan: PlanEnrollment[], now: Date) => {
    // No seeded row may be dated after the plan's own reference "now" - a
    // future-dated row broke Recent Activity's relative-time display and
    // inflated the current month's KPI count (see FINDINGS.md). This is a
    // hard fail, not a warning: it means a date-range computation elsewhere
    // in this function let its upper bound drift past `now`.
    const futureClasses = classesPlan.filter((c) => c.createdAt > now);
    const futureEnrollments = enrollmentsPlan.filter((e) => e.createdAt > now);
    if (futureClasses.length > 0 || futureEnrollments.length > 0) {
        throw new Error(
            `Seed plan sanity check failed: ${futureClasses.length} class(es) and ${futureEnrollments.length} enrollment(s) dated after "now" (${now.toISOString()})`
        );
    }

    const buckets = new Set(
        classesPlan.map((cls, i) => {
            const active = enrollmentsPlan.filter((e) => e.classIndex === i && e.status === "active").length;
            return fillBucket(cls.capacity > 0 ? active / cls.capacity : 0);
        })
    );
    if (buckets.size < 5) {
        throw new Error(`Seed plan sanity check failed: only ${buckets.size}/5 fill-rate buckets covered`);
    }

    const monthsSeen = new Set(enrollmentsPlan.map((e) => `${e.createdAt.getUTCFullYear()}-${e.createdAt.getUTCMonth()}`));
    if (monthsSeen.size < 12) {
        throw new Error(`Seed plan sanity check failed: only ${monthsSeen.size}/12 trailing months have an enrollment`);
    }

    // classCount/subjectCount/teacherCount are deterministic (fixed catalog,
    // fixed round-robin teacher assignment) - only studentCount depends on the
    // seed, via which enrollments happen to fall in the current calendar month.
    const subjectCount = new Set(classesPlan.map((c) => c.subjectCode)).size;
    const classCount = classesPlan.length;
    const teacherCount = new Set(classesPlan.map((c) => c.teacherIndex)).size;
    const currentMonthEnrollments = enrollmentsPlan.filter(
        (e) => e.createdAt.getUTCFullYear() === now.getUTCFullYear() && e.createdAt.getUTCMonth() === now.getUTCMonth()
    );
    const studentCount = new Set(currentMonthEnrollments.map((e) => e.studentIndex)).size;

    const kpis = [classCount, subjectCount, studentCount, teacherCount];
    if (new Set(kpis).size !== kpis.length) {
        throw new Error(
            `Seed plan sanity check failed: KPI values not distinct (classes=${classCount}, subjects=${subjectCount}, students=${studentCount}, faculty=${teacherCount})`
        );
    }
};

const generateSeedPlan = (seed: number): SeedPlan => {
    faker.seed(seed);

    const now = new Date();
    const monthWindows = buildMonthWindows(now);
    // Classes need to predate the trailing-12-month window almost entirely,
    // not just land somewhere inside it - a class "created" in month 3 of
    // the window has no fill-rate data for months 0-2, which is exactly
    // what turns the trend chart's early months into gaps. A small fraction
    // land recently instead (last ~50 days), which is what gives the
    // classes/faculty KPI cards a real non-zero previous-period count.
    const backboneStart = new Date(monthWindows[11]!.start.getTime() - 60 * 24 * 60 * 60 * 1000);
    const backboneEnd = monthWindows[11]!.start;
    const recentStart = new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000);

    const usedCodes = new Set<string>();
    const classesPlan: PlanClass[] = [];
    let fillIndex = 0;

    for (const dept of DEPARTMENT_CATALOG) {
        for (const subject of dept.subjects) {
            for (const section of sectionsFor(subject.code)) {
                const [min, max] = section.capacityRange;
                // Raw, unrounded - rounding every capacity to a multiple of
                // 5 was what made the column look generated rather than real.
                const capacity = faker.number.int({ min, max });
                const fillTarget = FILL_TARGETS[fillIndex++];
                if (fillTarget === undefined) {
                    throw new Error("FILL_TARGETS is shorter than the generated class count");
                }
                const status = faker.helpers.weightedArrayElement(CLASS_STATUS_WEIGHTS);
                const isRecent = faker.number.float({ min: 0, max: 1 }) < 0.18;
                const createdAt = isRecent
                    ? pickWeekdayLeaningDate(recentStart, now)
                    : pickWeekdayLeaningDate(backboneStart, backboneEnd);
                classesPlan.push({
                    departmentCode: dept.code,
                    subjectCode: subject.code,
                    name: `${subject.name} - ${section.suffix}`,
                    capacity,
                    inviteCode: planInviteCode(usedCodes),
                    teacherIndex: classesPlan.length % TEACHER_NAMES.length,
                    fillTarget,
                    status,
                    createdAt,
                });
            }
        }
    }

    // Guarantee at least one class - and, by preferring a single-class
    // teacher's class specifically, at least one genuinely *new* faculty
    // member too - lands in the current calendar month. "isRecent" above
    // only makes this likely: its 50-day window can miss the current month
    // entirely (e.g. early in the month, most of that window is still last
    // month), which is exactly what left the Classes/Faculty KPI cards
    // showing a flat 0% delta on some workspaces. Mirrors the enrollment
    // month-coverage top-up below: don't trust the probability, guarantee
    // the outcome, same as that pass already does for month coverage.
    const currentMonthWindow = monthWindows[0]!;
    const teacherClassCounts = new Map<number, number>();
    for (const cls of classesPlan) {
        teacherClassCounts.set(cls.teacherIndex, (teacherClassCounts.get(cls.teacherIndex) ?? 0) + 1);
    }
    const singleClassTeacherHasRecentClass = () =>
        classesPlan.some(
            (c) => c.createdAt >= currentMonthWindow.start && teacherClassCounts.get(c.teacherIndex) === 1
        );
    if (!singleClassTeacherHasRecentClass()) {
        const singleClassOwner = classesPlan.find((c) => teacherClassCounts.get(c.teacherIndex) === 1);
        const target = singleClassOwner ?? classesPlan[classesPlan.length - 1];
        if (target) target.createdAt = pickWeekdayLeaningDate(currentMonthWindow.start, now);
    }

    const monthCoverage = new Set<number>();
    const enrollmentsPlan: PlanEnrollment[] = [];

    classesPlan.forEach((cls, classIndex) => {
        const activeCount = Math.max(1, Math.round(cls.capacity * cls.fillTarget));
        // Waitlists only make sense once a class is nearly full; a few drops
        // happen anywhere past low attendance.
        const waitlistedCount = cls.fillTarget >= 0.75 ? Math.max(1, Math.round(cls.capacity * 0.05)) : 0;
        const droppedCount = cls.fillTarget >= 0.4 ? Math.round(cls.capacity * 0.03) : 0;

        const rosterSize = Math.min(activeCount + waitlistedCount + droppedCount, STUDENT_NAMES.length);
        const roster = faker.helpers.shuffle(STUDENT_NAMES.map((_, i) => i)).slice(0, rosterSize);

        roster.forEach((studentIndex, i) => {
            const status: EnrollmentStatus = i < activeCount ? "active" : i < activeCount + waitlistedCount ? "waitlisted" : "dropped";
            const windowIndex = faker.helpers.weightedArrayElement(
                monthWindows.map((w, idx) => ({ value: idx, weight: w.weight }))
            );
            const window = monthWindows[windowIndex]!;
            const createdAt = pickWeekdayLeaningDate(window.start, window.end);
            monthCoverage.add(windowIndex);
            enrollmentsPlan.push({ classIndex, studentIndex, status, createdAt });
        });
    });

    // Guarantee at least one student's EARLIEST enrollment lands in the
    // current month too. The ~140-person fixture pool is small relative to
    // the thousands of enrollment rows spread across 12 months of backdated
    // history, so in practice that history alone routinely already touches
    // every pool member at least once - which saturates the students KPI's
    // previous-period count at the same value as the total and leaves
    // nothing for the current month to add (a flat 0% delta, same root
    // cause as the classes/faculty gap above, just via saturation instead
    // of a missed random window). Move whichever student currently has the
    // fewest enrollment rows - least disruptive to relocate - entirely into
    // the current month if nobody would otherwise be "new" this month.
    //
    // Done before the month-coverage top-up below (not after), and
    // monthCoverage is rebuilt from scratch afterward: if this student
    // happened to be the sole coverage for some month, that top-up pass is
    // what catches and repairs it, rather than this leaving a silent gap
    // behind stale bookkeeping.
    const earliestByStudent = new Map<number, number>();
    const enrollmentCountByStudent = new Map<number, number>();
    for (const e of enrollmentsPlan) {
        const t = e.createdAt.getTime();
        const earliest = earliestByStudent.get(e.studentIndex);
        if (earliest === undefined || t < earliest) earliestByStudent.set(e.studentIndex, t);
        enrollmentCountByStudent.set(e.studentIndex, (enrollmentCountByStudent.get(e.studentIndex) ?? 0) + 1);
    }
    const hasNewStudentThisMonth = [...earliestByStudent.values()].some(
        (t) => t >= currentMonthWindow.start.getTime()
    );
    if (!hasNewStudentThisMonth && enrollmentCountByStudent.size > 0) {
        const [targetStudent] = [...enrollmentCountByStudent.entries()].sort((a, b) => a[1] - b[1])[0]!;
        for (const e of enrollmentsPlan) {
            if (e.studentIndex === targetStudent) {
                e.createdAt = pickWeekdayLeaningDate(currentMonthWindow.start, now);
            }
        }
        monthCoverage.clear();
        for (const e of enrollmentsPlan) {
            const idx = monthWindows.findIndex((w) => e.createdAt >= w.start && e.createdAt <= w.end);
            if (idx >= 0) monthCoverage.add(idx);
        }
    }

    // The weighted pick above makes full 12-month coverage likely but not
    // provable - top up any gap deterministically instead of trusting luck.
    for (let m = 0; m < 12; m++) {
        if (monthCoverage.has(m) || enrollmentsPlan.length === 0) continue;
        const donor = faker.helpers.arrayElement(enrollmentsPlan);
        const window = monthWindows[m]!;
        donor.createdAt = pickWeekdayLeaningDate(window.start, window.end);
        monthCoverage.add(m);
    }

    assertSeedPlanSanity(classesPlan, enrollmentsPlan, now);

    return { seed, classesPlan, enrollmentsPlan };
};

// ---- Fixture user upsert ---------------------------------------------------
async function upsertFixtureUsers(tx: DbOrTx, names: string[], role: "teacher" | "student"): Promise<string[]> {
    const emails = names.map(fixtureEmail);

    // One round trip to see what already exists, one bulk insert for what's
    // missing, one final round trip to read back authoritative ids - not N
    // round trips for N pool members, which matters now that the pool is this
    // large (every first-time visitor's sign-in pays this cost).
    const existing = await tx.select({ id: user.id, email: user.email }).from(user).where(inArray(user.email, emails));
    const idByEmail = new Map(existing.map((row) => [row.email, row.id]));

    const missing = names
        .map((name, i) => ({ name, email: emails[i]!, id: randomUUID() }))
        .filter((row) => !idByEmail.has(row.email));

    if (missing.length > 0) {
        await tx
            .insert(user)
            .values(
                missing.map((row) => ({
                    id: row.id,
                    name: row.name,
                    email: row.email,
                    role,
                    emailVerified: true,
                    image: buildFixtureAvatarUrl(row.email),
                })),
            )
            .onConflictDoNothing({ target: user.email });

        // A concurrent provision may have won the race on some emails since
        // the SELECT above - re-resolve from the DB rather than trusting the
        // locally-generated ids for anything that actually conflicted.
        const resolved = await tx
            .select({ id: user.id, email: user.email })
            .from(user)
            .where(inArray(user.email, missing.map((r) => r.email)));
        for (const row of resolved) idByEmail.set(row.email, row.id);
    }

    return names.map((_, i) => idByEmail.get(emails[i]!)!);
}

// ---- Shared catalog images ---------------------------------------------
// Subjects/classes are per-workspace rows (not a shared pool like
// teachers/students), so a real photo uploaded through the admin's own
// permanent workspace never appeared anywhere else - every other visitor's
// workspace only ever had the generated colour-block placeholder. That's a
// visual-only gap, not a data-isolation one: the catalog (subject codes,
// class names) is the same fixed list in every workspace, so "this subject
// code already has a real photo somewhere" is a safe, deterministic lookup
// that never touches another workspace's students/enrollments/classes. Keyed
// by the admin's OWN permanent workspace specifically (not just "any
// workspace with an image") so a future admin upload is the one source of
// truth every new/re-seeded workspace picks up, rather than a race between
// whichever workspace happened to get an image first.
type CatalogImages = {
    subjectImageByCode: Map<string, string>;
    classBannerByName: Map<string, string>;
};

async function fetchCatalogImages(tx: DbOrTx): Promise<CatalogImages> {
    const subjectRows = await tx
        .select({ code: subjects.code, imageCldPubId: subjects.imageCldPubId })
        .from(subjects)
        .innerJoin(demoWorkspaces, eq(subjects.workspaceId, demoWorkspaces.id))
        .where(and(eq(demoWorkspaces.isPermanent, true), isNotNull(subjects.imageCldPubId)));

    const classRows = await tx
        .select({ name: classes.name, bannerCldPubId: classes.bannerCldPubId })
        .from(classes)
        .innerJoin(demoWorkspaces, eq(classes.workspaceId, demoWorkspaces.id))
        .where(and(eq(demoWorkspaces.isPermanent, true), isNotNull(classes.bannerCldPubId)));

    return {
        subjectImageByCode: new Map(subjectRows.map((r) => [r.code, r.imageCldPubId!])),
        classBannerByName: new Map(classRows.map((r) => [r.name, r.bannerCldPubId!])),
    };
}

// ---- Entry point ------------------------------------------------------
// Builds the entire fixture dataset in memory first (deterministic from
// `initialSeed`, validated by assertSeedPlanSanity) and only then writes it -
// so a failed sanity check never leaves a partially-seeded workspace behind,
// and a retry just tries a new seed rather than needing to undo DB writes.
// Returns the seed actually used (may differ from initialSeed after a retry)
// so the caller can persist and log the one that reproduces this exact data.
export const seedWorkspace = async (tx: DbOrTx, workspaceId: string, initialSeed: number): Promise<number> => {
    const teacherIds = await upsertFixtureUsers(tx, TEACHER_NAMES, "teacher");
    const studentIds = await upsertFixtureUsers(tx, STUDENT_NAMES, "student");
    const catalogImages = await fetchCatalogImages(tx);

    const MAX_PLAN_ATTEMPTS = 5;
    let plan: SeedPlan | undefined;
    let seed = initialSeed;
    for (let attempt = 0; attempt < MAX_PLAN_ATTEMPTS; attempt++) {
        try {
            plan = generateSeedPlan(seed);
            break;
        } catch (e) {
            console.warn(`seedWorkspace: seed ${seed} failed its sanity check (${(e as Error).message}), retrying with seed ${seed + 1}`);
            seed += 1;
        }
    }
    if (!plan) throw new Error(`seedWorkspace: failed to generate a sane seed plan after ${MAX_PLAN_ATTEMPTS} attempts`);

    // Departments/subjects are the curriculum's backbone - always predate
    // the trailing-12-month window, same reasoning as classes above. Not
    // part of the faker-seeded plan (they're driven by the fixed catalog,
    // not randomised counts/fill targets), but still deterministic overall
    // since faker's seed was already set by generateSeedPlan and its stream
    // just continues here.
    const catalogNow = new Date();
    const catalogWindows = buildMonthWindows(catalogNow);
    const catalogBackboneStart = new Date(catalogWindows[11]!.start.getTime() - 60 * 24 * 60 * 60 * 1000);
    const catalogBackboneEnd = catalogWindows[11]!.start;
    const catalogRecentStart = new Date(catalogNow.getTime() - 50 * 24 * 60 * 60 * 1000);

    const deptIds: Record<string, number> = {};
    for (const dept of DEPARTMENT_CATALOG) {
        const [created] = await tx
            .insert(departments)
            .values({
                workspaceId,
                code: dept.code,
                name: dept.name,
                description: dept.description,
                origin: "seed",
                createdAt: pickWeekdayLeaningDate(catalogBackboneStart, catalogBackboneEnd),
            })
            .returning({ id: departments.id });
        deptIds[dept.code] = created!.id;
    }

    // A couple of subjects land recently rather than 100% backbone, so the
    // subjects KPI card also gets a real (non-zero) previous-period count -
    // otherwise it's stuck null like classes/faculty were before this fix.
    // Built as an in-memory plan first, same reason as the classes/faculty
    // guarantee above: landing somewhere in the last 50 days is likely to
    // fall in the current calendar month, not certain to - early in a
    // month, most of that window is still last month. Guaranteed below
    // instead of left to chance.
    let recentSubjectCount = 0;
    const subjectsPlan: { dept: DepartmentDef; subject: SubjectDef; createdAt: Date }[] = [];
    for (const dept of DEPARTMENT_CATALOG) {
        for (const subject of dept.subjects) {
            const isRecent = recentSubjectCount < 2 && faker.number.float({ min: 0, max: 1 }) < 0.12;
            if (isRecent) recentSubjectCount++;
            const createdAt = isRecent
                ? pickWeekdayLeaningDate(catalogRecentStart, catalogNow)
                : pickWeekdayLeaningDate(catalogBackboneStart, catalogBackboneEnd);
            subjectsPlan.push({ dept, subject, createdAt });
        }
    }
    const currentCatalogMonth = catalogWindows[0]!;
    const hasSubjectThisMonth = subjectsPlan.some((s) => s.createdAt >= currentCatalogMonth.start);
    if (!hasSubjectThisMonth) {
        const target = subjectsPlan[subjectsPlan.length - 1];
        if (target) target.createdAt = pickWeekdayLeaningDate(currentCatalogMonth.start, catalogNow);
    }

    const subjectIds: Record<string, number> = {};
    for (const { dept, subject, createdAt } of subjectsPlan) {
        const [created] = await tx
            .insert(subjects)
            .values({
                workspaceId,
                code: subject.code,
                name: subject.name,
                description: subject.description,
                departmentId: deptIds[dept.code]!,
                origin: "seed",
                imageCldPubId: catalogImages.subjectImageByCode.get(subject.code) ?? null,
                createdAt,
            })
            .returning({ id: subjects.id });
        subjectIds[subject.code] = created!.id;
    }

    const classIds: number[] = [];
    for (const cls of plan.classesPlan) {
        const [created] = await tx
            .insert(classes)
            .values({
                workspaceId,
                name: cls.name,
                subjectId: subjectIds[cls.subjectCode]!,
                teacherId: teacherIds[cls.teacherIndex]!,
                capacity: cls.capacity,
                status: cls.status,
                description: `${cls.name.split(" - ")[0]} for the current term.`,
                inviteCode: cls.inviteCode,
                schedules: [],
                origin: "seed",
                bannerCldPubId: catalogImages.classBannerByName.get(cls.name) ?? null,
                createdAt: cls.createdAt,
            })
            .returning({ id: classes.id });
        classIds.push(created!.id);
    }

    // One row per round trip here used to mean ~900 sequential awaits for a
    // typical workspace - fine individually, but the dominant cost of the
    // whole provision and the main reason C1's transaction needed to worry
    // about duration/timeout at all. Chunked multi-row INSERTs cut that to a
    // handful of round trips; the chunk size is just a sane batch bound, not
    // load-bearing for correctness (still inside the same transaction either
    // way).
    const ENROLLMENT_INSERT_CHUNK_SIZE = 200;
    const enrollmentRows = plan.enrollmentsPlan.map((e) => ({
        workspaceId,
        classId: classIds[e.classIndex]!,
        studentId: studentIds[e.studentIndex]!,
        status: e.status,
        createdAt: e.createdAt,
        origin: "seed" as const,
    }));
    for (let i = 0; i < enrollmentRows.length; i += ENROLLMENT_INSERT_CHUNK_SIZE) {
        await tx.insert(enrollments).values(enrollmentRows.slice(i, i + ENROLLMENT_INSERT_CHUNK_SIZE));
    }

    return plan.seed;
};
