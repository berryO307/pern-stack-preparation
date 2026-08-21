import { betterAuth } from "better-auth";
import { anonymous } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.js";
import * as schema from '../db/schema/auth.js'

// Randomized so guest display names don't collide/look scripted, e.g. "Guest Falcon 4821".
const GUEST_ADJECTIVES = ["Curious", "Swift", "Bright", "Quiet", "Bold", "Calm", "Eager", "Nimble"];
const GUEST_ANIMALS = ["Falcon", "Otter", "Panda", "Heron", "Fox", "Lynx", "Wren", "Ibis"];

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET!,
    trustedOrigins: [process.env.FRONTEND_URL!],
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
    }),
    emailAndPassword: {
        enabled: true,
        // Public self-registration is disabled - the only email/password account is the
        // admin, seeded directly (see db-seed.ts). Everyone else uses the anonymous guest
        // flow below, so no real visitor's email is ever collected or persisted.
        disableSignUp: true,
        // No email provider is configured for this project yet, so the reset link is
        // logged instead of sent. Replace with a real provider (Resend, SES, etc.) before shipping.
        sendResetPassword: async ({ user, url }) => {
            console.log(`Password reset requested for ${user.email}: ${url}`);
        },
    },
    user: {
        additionalFields: {
            // input: false — role must never be settable by the client through
            // better-auth's own account/profile endpoints (e.g. update-user).
            // The only legitimate way to change a role is the app's own
            // PUT /api/users/:id, which is requireAdmin-gated and writes via a
            // direct Drizzle query that bypasses this field config entirely.
            role: {
                type: "string", required: true, defaultValue: 'student', input: false,
            },
            imageCldPubId: {
                type: "string", required: false, input: true,
            }
        }
    },
    plugins: [
        anonymous({
            emailDomainName: "guest.local",
            generateName: () => {
                const adjective = GUEST_ADJECTIVES[Math.floor(Math.random() * GUEST_ADJECTIVES.length)];
                const animal = GUEST_ANIMALS[Math.floor(Math.random() * GUEST_ANIMALS.length)];
                const suffix = Math.floor(1000 + Math.random() * 9000);
                return `Guest ${adjective} ${animal} ${suffix}`;
            },
        }),
    ],
});