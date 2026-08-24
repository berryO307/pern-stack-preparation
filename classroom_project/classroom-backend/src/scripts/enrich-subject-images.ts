import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { subjects, demoWorkspaces } from "../db/schema/index.js";
import { cloudinary, isCloudinaryApiConfigured } from "../lib/cloudinaryClient.js";

// One-time (re-runnable) enrichment: for each subject in the admin's
// permanent workspace, search the Cloudinary account's own media library
// for an existing asset matching the subject's topic, and store the first
// match's public_id on subjects.imageCldPubId. Never uploads or hotlinks
// anything - only looks up what's already in the account. A subject with
// no match keeps falling back to the generated colour+caption banner
// (lib/cloudinary.ts on the frontend), which is a real, deliberate state,
// not an error.
//
// Run with: tsx src/scripts/enrich-subject-images.ts
// Requires CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env - these
// come from the Cloudinary console (Dashboard -> API Keys), never typed
// into chat.

// Broader than the subject's own name on purpose - a fresh/mostly-empty
// Cloudinary library is far more likely to contain something matching a
// general department theme than a specific course title.
const DEPARTMENT_SEARCH_TERMS: Record<string, string> = {
    "Computer Science": "computer",
    Mathematics: "math",
    "Business Administration": "business",
    "Fine Arts": "art",
    Physics: "physics",
    Psychology: "psychology",
    "Environmental Science": "nature",
};

async function findMatch(searchTerm: string): Promise<string | undefined> {
    const result = await cloudinary.search
        .expression(searchTerm)
        .max_results(3)
        .execute();
    return result?.resources?.[0]?.public_id;
}

async function main() {
    if (!isCloudinaryApiConfigured) {
        console.error(
            "CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET are not set in classroom-backend/.env - " +
            "add them from your Cloudinary console (Dashboard -> API Keys) and re-run."
        );
        process.exit(1);
    }

    const [workspace] = await db.select().from(demoWorkspaces).where(eq(demoWorkspaces.isPermanent, true));
    if (!workspace) throw new Error("No permanent (admin) workspace found");

    const allSubjects = await db
        .select({
            id: subjects.id,
            name: subjects.name,
            code: subjects.code,
            departmentId: subjects.departmentId,
        })
        .from(subjects)
        .where(eq(subjects.workspaceId, workspace.id));

    // Need department names for the search-term map, not just ids.
    const { departments } = await import("../db/schema/index.js");
    const deptRows = await db.select().from(departments).where(eq(departments.workspaceId, workspace.id));
    const deptNameById = new Map(deptRows.map((d) => [d.id, d.name]));

    let matched = 0;
    let unmatched = 0;

    for (const subject of allSubjects) {
        const departmentName = deptNameById.get(subject.departmentId);
        const searchTerm = (departmentName && DEPARTMENT_SEARCH_TERMS[departmentName]) || subject.name;

        let publicId: string | undefined;
        try {
            publicId = await findMatch(searchTerm);
            if (!publicId && searchTerm !== subject.name) {
                publicId = await findMatch(subject.name);
            }
        } catch (e) {
            console.error(`Search failed for "${subject.name}" (${subject.code}): ${(e as Error).message}`);
            continue;
        }

        if (publicId) {
            await db.update(subjects).set({ imageCldPubId: publicId }).where(eq(subjects.id, subject.id));
            console.log(`MATCHED  ${subject.code} "${subject.name}" -> ${publicId}`);
            matched++;
        } else {
            console.log(`no match ${subject.code} "${subject.name}" (searched "${searchTerm}")`);
            unmatched++;
        }
    }

    console.log(`\n${matched} matched, ${unmatched} unmatched out of ${allSubjects.length} subjects.`);
    if (unmatched > 0) {
        console.log(
            "Unmatched subjects fall back to the generated colour+caption banner - " +
            "upload real images to your Cloudinary library (tagged/named to match a department, " +
            "e.g. containing \"computer\", \"physics\", \"psychology\"...) and re-run this script to pick them up."
        );
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
