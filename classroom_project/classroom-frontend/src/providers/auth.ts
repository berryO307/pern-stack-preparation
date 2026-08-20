import type { AuthProvider } from "@refinedev/core";
import { authClient } from "@/lib/auth-client.ts";

const FRONTEND_ORIGIN = window.location.origin;

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
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

  register: async ({ email, password, name }) => {
    // The `role` field is a server-side additionalField (see backend lib/auth.ts) not
    // present in the client's base signUp type, so route it through an untyped payload.
    const payload = { email, password, name, role: "student" };
    const { error } = await authClient.signUp.email(payload);

    if (error) {
      return {
        success: false,
        error: {
          name: "RegisterError",
          message: error.message ?? "Failed to create account",
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
