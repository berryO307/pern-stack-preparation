import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.js";
import * as schema from '../db/schema/auth.js'

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET!,
    trustedOrigins: [process.env.FRONTEND_URL!],
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
    }),
    emailAndPassword: {
        enabled: true,
        // No email provider is configured for this project yet, so the reset link is
        // logged instead of sent. Replace with a real provider (Resend, SES, etc.) before shipping.
        sendResetPassword: async ({ user, url }) => {
            console.log(`Password reset requested for ${user.email}: ${url}`);
        },
    },
    user: {
        additionalFields: {
            role: {
                type: "string", required: true, defaultValue: 'student', input: true,
            },
            imageCldPubId: {
                type: "string", required: false, input: true,
            }
        }
    }
});