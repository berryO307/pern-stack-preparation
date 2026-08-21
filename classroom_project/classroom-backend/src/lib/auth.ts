import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.js";
import * as schema from '../db/schema/auth.js'

// The site owner's real identity — checked on every new sign-up so the one
// account that should have standing (non-workspace-scoped) admin access gets
// it automatically via their own Google/GitHub login, with no password and
// no separate seed step. Comma-separated, case-insensitive.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

// Frontend (Vercel) and backend (Railway) are different registrable domains
// in production, not subdomains of one root domain - that's a genuine
// cross-site request, and Better Auth's own default (`sameSite: "lax"`)
// is never sent on those. Without this the session cookie silently fails to
// attach to any frontend->backend fetch and auth breaks end-to-end.
// `SameSite=None` requires `Secure`, which requires HTTPS - conditioned on
// NODE_ENV so local dev (http://localhost, same site across ports) keeps
// using the plain default instead of dropping cookies entirely.
const isProduction = process.env.NODE_ENV === "production";

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET!,
    trustedOrigins: [process.env.FRONTEND_URL!],
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
    }),
    // Social-only: this is a public demo, so no password/reset/verification
    // state machine and no email provider to run. See db/schema/auth.ts for
    // the account.password column this leaves unused — dropping it is a
    // deliberate follow-up migration once nothing writes to it anymore,
    // not part of this change.
    emailAndPassword: {
        enabled: false,
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
        github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        },
    },
    account: {
        accountLinking: {
            // Already the default in this Better Auth version, set explicitly:
            // a GitHub sign-in and a later Google sign-in on the same verified
            // email link into one user rather than creating two.
            enabled: true,
            trustedProviders: ["google", "github"],
        },
    },
    // 7 days — deliberately longer than a demo workspace's 1-hour lifetime.
    // The Better Auth session (a real Google/GitHub identity) outlives the
    // ephemeral workspace on purpose: returning visitors get recognized and
    // re-provisioned, not logged out, when their workspace expires.
    session: {
        expiresIn: 60 * 60 * 24 * 7,
    },
    user: {
        additionalFields: {
            role: {
                type: "string", required: true, defaultValue: 'student', input: false,
            },
            imageCldPubId: {
                type: "string", required: false, input: true,
            }
        }
    },
    databaseHooks: {
        user: {
            create: {
                before: async (user) => {
                    const isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());
                    return { data: { ...user, role: isAdmin ? "admin" : user.role } };
                },
            },
        },
    },
    advanced: {
        defaultCookieAttributes: isProduction
            ? { sameSite: "none", secure: true }
            : undefined,
    },
});
