import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

// Same-origin, not the backend's own domain - the browser must never talk to
// Railway directly for auth. iOS Safari/Chrome (WebKit) block third-party
// cookies under ITP, so a session cookie set by a cross-site response never
// survives; and Better Auth's post-login redirect resolves relative to
// wherever the request landed, so a direct cross-origin call strands the
// user on the backend's own bare root route after sign-in. vercel.json (prod)
// and vite.config.ts's dev proxy both forward /api/* to the backend
// transparently, so this origin is always correct in both environments.
export const authClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [
    inferAdditionalFields({
      user: {
        role: {
          type: "string",
          required: true,
        },
        imageCldPubId: {
          type: "string",
          required: false,
        },
      },
    }),
  ],
});
