import { betterAuth, APIError } from "better-auth";
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
// in production. The browser never talks to this origin directly though -
// vercel.json rewrites /api/* to here transparently, so every request Better
// Auth sees actually arrived via the frontend's own domain from the
// browser's perspective. That makes the session cookie a normal first-party
// cookie (SameSite=Lax is enough - no SameSite=None/ITP exposure on iOS
// Safari or Chrome for iOS, both WebKit).
//
// `baseURL` still has to be set explicitly to the frontend's origin: without
// it, Better Auth infers baseURL from whatever host actually receives the
// request, which - once Vercel forwards it - is Railway's own domain, not
// the frontend's. Every URL Better Auth generates from that inferred value
// (crucially, the OAuth redirect_uri handed to Google/GitHub, and the
// post-login redirect target) would then point at the bare backend, landing
// a signed-in user on its unstyled root route instead of the app. Explicit
// baseURL is what makes those resolve to the frontend regardless of which
// host physically handled the request.
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && (!process.env.FRONTEND_URL || process.env.FRONTEND_URL.includes("localhost"))) {
    throw new Error(
        "FRONTEND_URL is missing or still points at localhost in production - " +
        "Better Auth would silently generate backend-origin redirect/callback " +
        "URLs and strand every sign-in on the bare API root."
    );
}

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET!,
    baseURL: process.env.FRONTEND_URL!,
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
            // Deliberately WITHOUT trustedProviders: Better Auth's own linking
            // logic (oauth2/link-account.ts) only checks the incoming sign-in's
            // own emailVerified flag when the provider ISN'T in trustedProviders
            // - listing "google"/"github" there bypasses that check entirely
            // for both, requiring only that the *existing stored* account is
            // verified (requireLocalEmailVerified, on by default). That's a
            // real account-takeover gap: register a GitHub account with an
            // unverified email claiming a real user's address, sign in, and
            // get silently merged into their account. Both providers already
            // report emailVerified accurately (Google's id_token claim,
            // GitHub's own /user/emails "verified" flag - see the github
            // provider source), so the default (require verified on *both*
            // sides) costs nothing functionally and closes the gap.
            enabled: true,
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
                    // The GitHub provider already falls back to the
                    // primary-verified (or first verified) address from
                    // /user/emails when the profile itself omits one (see
                    // @better-auth/core/social-providers/github.ts) - so
                    // this is only reachable when a GitHub account genuinely
                    // has no verified email at all. Refusing here beats
                    // creating a user row nothing downstream can address:
                    // ADMIN_EMAILS.includes() would throw on a null email
                    // anyway, and a contactless, unlinkable account is worse
                    // than a clear failure at sign-in.
                    if (!user.email) {
                        throw new APIError("BAD_REQUEST", {
                            message: "Your account has no verified email address to sign in with. Please verify an email on your provider account and try again.",
                        });
                    }
                    const isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());
                    return { data: { ...user, role: isAdmin ? "admin" : user.role } };
                },
            },
        },
    },
    advanced: {
        // First-party now that /api/* is same-origin via the Vercel/Vite
        // proxy (see the baseURL comment above) - SameSite=Lax is the normal,
        // unrestricted case, not the degraded SameSite=None fallback iOS's
        // ITP would still partially block. No `domain` attribute: leaving it
        // unset makes the cookie host-only, bound to whichever origin the
        // browser actually requested (the frontend's), which is required -
        // vercel.app and up.railway.app are both on the public suffix list,
        // so a shared parent domain isn't achievable even if it were wanted.
        defaultCookieAttributes: isProduction
            ? { sameSite: "lax", secure: true }
            : undefined,
    },
});

console.log(
    `[auth] baseURL=${process.env.FRONTEND_URL ?? "(unset - inferred from request host)"} ` +
    `trustedOrigins=${JSON.stringify([process.env.FRONTEND_URL])} ` +
    `cookies=${isProduction ? "SameSite=Lax; Secure; host-only" : "dev defaults"}`
);
