"use client";

import { useState } from "react";
import { useSearchParams } from "react-router";

import { useUpdatePassword, useRefineOptions, useLink } from "@refinedev/core";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { InputPassword } from "@/components/refine-ui/form/input-password";
import { cn } from "@/lib/utils";

export const ResetPasswordForm = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? undefined;
  const error = searchParams.get("error");

  const Link = useLink();

  const { title } = useRefineOptions();

  const { mutate: updatePassword, isPending } = useUpdatePassword();

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (password !== confirmPassword) return;

    updatePassword({ password, token });
  };

  return (
    <div
      className={cn(
        "flex",
        "flex-col",
        "items-center",
        "justify-center",
        "px-6",
        "py-8",
        "min-h-svh"
      )}
    >
      <div className={cn("flex", "items-center", "justify-center", "gap-2")}>
        {title.icon && (
          <div
            className={cn("text-foreground", "[&>svg]:w-12", "[&>svg]:h-12")}
          >
            {title.icon}
          </div>
        )}
      </div>

      <Card className={cn("sm:w-[456px]", "p-12", "mt-6")}>
        <CardHeader className={cn("px-0")}>
          <CardTitle
            className={cn(
              "text-blue-600",
              "dark:text-blue-400",
              "text-3xl",
              "font-semibold"
            )}
          >
            Reset password
          </CardTitle>
          <CardDescription
            className={cn("text-muted-foreground", "font-medium")}
          >
            Choose a new password for your account.
          </CardDescription>
        </CardHeader>

        <CardContent className={cn("px-0")}>
          {error || !token ? (
            <p className={cn("text-sm", "text-destructive")}>
              This reset link is invalid or has expired. Please request a new
              one.
            </p>
          ) : (
            <form onSubmit={handleResetPassword}>
              <div className={cn("flex", "flex-col", "gap-2")}>
                <Label htmlFor="password">New password</Label>
                <InputPassword
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <div
                className={cn("flex", "flex-col", "gap-2", "mt-6")}
              >
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <InputPassword
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className={cn("text-sm", "text-destructive")}>
                    Passwords don&apos;t match.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                className={cn("w-full", "mt-6")}
                disabled={isPending}
              >
                {isPending ? "Resetting..." : "Reset password"}
              </Button>
            </form>
          )}

          <div className={cn("mt-8", "text-center")}>
            <Link
              to="/login"
              className={cn(
                "text-sm",
                "text-muted-foreground",
                "hover:text-foreground",
                "transition-colors"
              )}
            >
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

ResetPasswordForm.displayName = "ResetPasswordForm";
