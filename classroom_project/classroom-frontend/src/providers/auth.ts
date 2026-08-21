import type { AuthProvider } from "@refinedev/core";
import { authClient } from "@/lib/auth-client.ts";

const FRONTEND_ORIGIN = window.location.origin;

export const authProvider: AuthProvider = {
  login: async (params) => {
    if (params?.guest) {
      const { error } = await authClient.signIn.anonymous();

      if (error) {
        return {
          success: false,
          error: {
            name: "GuestLoginError",
            message: error.message ?? "Failed to start a guest session",
          },
        };
      }

      return { success: true, redirectTo: "/" };
    }

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

    const anonUser = data.user as typeof data.user & { isAnonymous?: boolean; role?: string };

    return {
      id: anonUser.id,
      name: anonUser.name,
      fullName: anonUser.name,
      email: anonUser.email,
      avatar: anonUser.image ?? undefined,
      role: anonUser.role,
      isAnonymous: Boolean(anonUser.isAnonymous),
    };
  },

  forgotPassword: async ({ email }) => {
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${FRONTEND_ORIGIN}/reset-password`,
    });

    if (error) {
      return {
        success: false,
        error: {
          name: "ForgotPasswordError",
          message: error.message ?? "Failed to send reset email",
        },
      };
    }

    return {
      success: true,
      successNotification: {
        message: "Check your email",
        description: "If that email exists, a reset link is on its way.",
      },
    };
  },

  updatePassword: async ({ password, token }) => {
    const { error } = await authClient.resetPassword({
      newPassword: password,
      token,
    });

    if (error) {
      return {
        success: false,
        error: {
          name: "UpdatePasswordError",
          message: error.message ?? "Failed to reset password",
        },
      };
    }

    return { success: true, redirectTo: "/login" };
  },
};
