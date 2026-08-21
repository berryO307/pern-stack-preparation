import type { AuthProvider } from "@refinedev/core";
import { authClient } from "@/lib/auth-client.ts";

export const authProvider: AuthProvider = {
  login: async (params) => {
    const { email, password } = params;
    const { error } = await authClient.signIn.email({ email, password });

    if (error) {
      return {
        success: false,
        error: {
          name: "LoginError",
          message: error.message ?? "Invalid email or password",
        },
      };
    }

    return { success: true, redirectTo: "/" };
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

    const user = data.user as typeof data.user & { role?: string };

    return {
      id: user.id,
      name: user.name,
      fullName: user.name,
      email: user.email,
      avatar: user.image ?? undefined,
      role: user.role,
    };
  },
};
