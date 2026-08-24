import "dotenv/config";
import { and, eq, isNotNull, isNull, ne } from "drizzle-orm";
import { db } from "../db/index.js";
import { classes, demoWorkspaces, subjects } from "../db/schema/index.js";

// One-time catch-up for workspaces seeded before seedWorkspace.ts started
// copying the admin's real catalog photos into every new workspace (see the
// comment on fetchCatalogImages there). Every workspace seeded AFTER that
// change already gets this for free; this just repairs the ones seeded
// before it, in place - only ever fills a currently-null image/banner, never
// overwrites one, and touches no other column (students/enrollments/classes
// data is untouched).
//
// Run: npx tsx src/scripts/backfill-catalog-images.ts

async function main() {
    const [adminWorkspace] = await db.select().from(demoWorkspaces).where(eq(demoWorkspaces.isPermanent, true));
    if (!adminWorkspace) {
        console.log("No permanent (admin) workspace found - nothing to copy from.");
        return;
    }

    const realSubjects = await db
        .select({ code: subjects.code, imageCldPubId: subjects.imageCldPubId })
        .from(subjects)
        .where(and(eq(subjects.workspaceId, adminWorkspace.id), isNotNull(subjects.imageCldPubId)));
    const realClasses = await db
        .select({ name: classes.name, bannerCldPubId: classes.bannerCldPubId })
        .from(classes)
        .where(and(eq(classes.workspaceId, adminWorkspace.id), isNotNull(classes.bannerCldPubId)));

    console.log(`Admin workspace has ${realSubjects.length} subject photo(s) and ${realClasses.length} class banner(s) to copy.`);

    let subjectsUpdated = 0;
    for (const s of realSubjects) {
        const result = await db
            .update(subjects)
            .set({ imageCldPubId: s.imageCldPubId })
            .where(and(eq(subjects.code, s.code), isNull(subjects.imageCldPubId), ne(subjects.workspaceId, adminWorkspace.id)))
            .returning({ id: subjects.id });
        subjectsUpdated += result.length;
    }

    let classesUpdated = 0;
    for (const c of realClasses) {
        const result = await db
            .update(classes)
            .set({ bannerCldPubId: c.bannerCldPubId })
            .where(and(eq(classes.name, c.name), isNull(classes.bannerCldPubId), ne(classes.workspaceId, adminWorkspace.id)))
            .returning({ id: classes.id });
        classesUpdated += result.length;
    }

    console.log(`Updated ${subjectsUpdated} subject row(s) and ${classesUpdated} class row(s) across all other workspaces.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
