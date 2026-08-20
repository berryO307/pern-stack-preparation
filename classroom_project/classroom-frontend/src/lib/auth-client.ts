import { createAuthClient } from "better-auth/react";
import { anonymousClient } from "better-auth/client/plugins";
import { BACKEND_BASE_URL } from "@/constants";

const backendOrigin = BACKEND_BASE_URL.replace(/\/api\/?$/, "");

export const authClient = createAuthClient({
  baseURL: backendOrigin,
  plugins: [anonymousClient()],
});
