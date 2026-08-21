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
