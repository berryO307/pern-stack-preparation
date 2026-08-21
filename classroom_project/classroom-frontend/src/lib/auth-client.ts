import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { BACKEND_BASE_URL } from "@/constants";

const backendOrigin = BACKEND_BASE_URL.replace(/\/api\/?$/, "");

export const authClient = createAuthClient({
  baseURL: backendOrigin,
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
