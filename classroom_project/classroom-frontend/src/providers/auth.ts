import type { AuthProvider } from "@refinedev/core";
import { authClient } from "@/lib/auth-client.ts";

export const authProvider: AuthProvider = {
  login: async (params) => {
    const provider = params?.provider as "google" | "github" | undefined;

    if (!provider) {
      return {
        success: false,
        error: {
          name: "LoginError",
          message: "Choose a sign-in provider",
        },
      };
    }

    // On success this redirects the whole page to the provider's consent
    // screen, so this promise only ever resolves on a pre-redirect failure
    // (e.g. network error) — there's no post-login branch to handle here.
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: "/",
    });

    if (error) {
      return {
        success: false,
        error: {
          name: "LoginError",
          message: error.message ?? `Failed to sign in with ${provider}`,
        },
      };
    }

    return { success: true };
  },

  logout: async () => {
    await authClient.signOut();
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const { data } = await authClient.getSession();

    if (data?.session) {
      return { authenticated: true };
    }

    return {
      authenticated: false,
      redirectTo: "/login",
    };
  },

  onError: async (error) => {
    if (error?.status === 401 || error?.statusCode === 401) {
      return { logout: true, redirectTo: "/login" };
    }

    return { error };
  },

  getIdentity: async () => {
    const { data } = await authClient.getSession();

    if (!data?.user) return null;

    return {
      id: data.user.id,
      name: data.user.name,
      fullName: data.user.name,
      email: data.user.email,
      avatar: data.user.image ?? undefined,
      role: data.user.role,
    };
  },
};
