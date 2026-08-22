import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { classes } from "../db/schema/index.js";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const MAX_ATTEMPTS = 10;

export const INVITE_CODE_PATTERN = /^[A-Z]{3}[0-9]{3}$/;

const randomChar = (charset: string) => charset[Math.floor(Math.random() * charset.length)]!;

const generateCandidate = () =>
    Array.from({ length: 3 }, () => randomChar(LETTERS)).join("") +
    Array.from({ length: 3 }, () => randomChar(DIGITS)).join("");

// Produces a code matching ^[A-Z]{3}[0-9]{3}$ (e.g. "CSE101"), unique within
// the given workspace. The space is ~17.6M (26^3 * 10^3) combinations, large
// enough that a handful of retries on collision is enough - failing loudly
// after MAX_ATTEMPTS beats silently inserting a duplicate that the DB CHECK
// constraint would reject anyway.
export const generateInviteCode = async (workspaceId: string): Promise<string> => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const candidate = generateCandidate();
        const [existing] = await db
            .select({ id: classes.id })
            .from(classes)
            .where(and(eq(classes.workspaceId, workspaceId), eq(classes.inviteCode, candidate)));

        if (!existing) return candidate;
    }

    throw new Error(`Failed to generate a unique invite code after ${MAX_ATTEMPTS} attempts`);
};
