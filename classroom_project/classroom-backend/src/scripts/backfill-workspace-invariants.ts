import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { demoWorkspaces } from "../db/schema/index.js";
import { checkWorkspaceInvariants, isWorkspaceHealthy } from "../lib/workspace.js";
import { seedWorkspace } from "../lib/seedWorkspace.js";
import { randomInt } from "crypto";

// D4: runs D1's invariants across every existing workspace and re-provisions
// whatever fails. Safe to re-run - re-provisioning is the same atomic,
// idempotent path every normal sign-in uses (see lib/workspace.ts), just
// invoked directly instead of from the route. The admin's permanent
// workspace is included deliberately: isPermanent exempts it from expiry
// and the sweep job, not from having to actually be correct.
//
// Run: npx tsx src/scripts/backfill-workspace-invariants.ts

async function reprovision(userId: string, isPermanent: boolean, expiresAt: Date): Promise<string> {
    return db.transaction(async (tx) => {
        const [row] = await tx.select().from(demoWorkspaces).where(eq(demoWorkspaces.userId, userId));
        if (row) await tx.delete(demoWorkspaces).where(eq(demoWorkspaces.id, row.id));

        const [created] = await tx
            .insert(demoWorkspaces)
            .values({ userId, isPermanent, expiresAt })
            .returning();
        const seedValue = await seedWorkspace(tx, created!.id, randomInt(0, 2 ** 31 - 1));
        await tx
            .update(demoWorkspaces)
            .set({ seededAt: new Date(), seedValue })
            .where(eq(demoWorkspaces.id, created!.id));
        return created!.id;
    });
}

async function main() {
    const workspaces = await db.select().from(demoWorkspaces);
    console.log(`Checking ${workspaces.length} workspace(s)...`);

    let healthy = 0;
    let repaired = 0;
    let unrepairable = 0;

    for (const ws of workspaces) {
        const checks = await checkWorkspaceInvariants(ws.id);
        if (isWorkspaceHealthy(checks)) {
            healthy++;
            console.log(`  OK      ${ws.id} (user ${ws.userId})`);
            continue;
        }

        const failed = checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.detail}`);
        console.log(`  BROKEN  ${ws.id} (user ${ws.userId}) - ${failed.join("; ")}`);

        try {
            const newId = await reprovision(ws.userId, ws.isPermanent, ws.expiresAt);
            const recheck = await checkWorkspaceInvariants(newId);
            if (isWorkspaceHealthy(recheck)) {
                repaired++;
                console.log(`    -> repaired as ${newId}`);
            } else {
                unrepairable++;
                console.log(`    -> re-provisioned as ${newId} but STILL failing invariants - needs manual review`);
            }
        } catch (e) {
            unrepairable++;
            console.log(`    -> repair attempt threw: ${(e as Error).message}`);
        }
    }

    console.log(`\nHealthy: ${healthy}. Repaired: ${repaired}. Unrepairable: ${unrepairable}.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
