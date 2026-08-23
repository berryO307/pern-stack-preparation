import "dotenv/config";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { user } from "../db/schema/index.js";

// One-off backfill - run manually with
// `tsx src/scripts/backfill-fixture-avatars.ts`. seedWorkspace.ts now sets a
// DiceBear avatar URL on every NEWLY-inserted fixture user, but fixture
// people already sitting in the database from before that change won't get
// one until this runs. Scoped to role IN (teacher, student) - never admin,
// so a real visitor's own account (or the site owner's) is untouched - with
// no image set yet, so it also can't overwrite anyone who already has a real
// uploaded photo.
//
// Deliberately not scoped to the `@example.edu` domain (an earlier version
// of this script was, and missed 5 older fixture teachers seeded before this
// session's @example.edu convention existed, at @classroom.demo and a
// leftover @example.com address - this covers those too).

const buildFixtureAvatarUrl = (seed: string): string =>
    `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}&radius=50`;

async function main() {
    const rows = await db
        .select({ id: user.id, email: user.email })
        .from(user)
        .where(
            and(
                inArray(user.role, ["teacher", "student"]),
                or(isNull(user.image), eq(user.image, "")),
            ),
        );

    console.log(`Found ${rows.length} fixture user(s) with no avatar set.`);

    for (const row of rows) {
        await db.update(user).set({ image: buildFixtureAvatarUrl(row.email) }).where(eq(user.id, row.id));
    }

    console.log(`Backfilled ${rows.length} avatar(s).`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
