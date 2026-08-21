"use client";

import { useState } from "react";

import { Github } from "lucide-react";

import { useLogin, useRefineOptions } from "@refinedev/core";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type SocialProvider = "google" | "github";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className={cn("w-4", "h-4")} aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.85A11 11 0 0 0 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.85z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

export const SignInForm = () => {
  const [activeProvider, setActiveProvider] = useState<SocialProvider | null>(
    null
  );

  const { title } = useRefineOptions();

  const { mutate: login, isPending } = useLogin();

  const handleSocialSignIn = (provider: SocialProvider) => {
    setActiveProvider(provider);
    login({ provider });
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
      <div className={cn("flex", "items-center", "justify-center")}>
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
            Sign in
          </CardTitle>
          <CardDescription
            className={cn("text-muted-foreground", "font-medium")}
          >
            Continue with a provider below
          </CardDescription>
        </CardHeader>

        <Separator />

        <CardContent className={cn("px-0", "flex", "flex-col", "gap-3")}>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className={cn("w-full", "gap-2")}
            onClick={() => handleSocialSignIn("google")}
            disabled={isPending}
          >
            <GoogleIcon />
            {isPending && activeProvider === "google"
              ? "Redirecting..."
              : "Continue with Google"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className={cn("w-full", "gap-2")}
            onClick={() => handleSocialSignIn("github")}
            disabled={isPending}
          >
            <Github className={cn("w-4", "h-4")} />
            {isPending && activeProvider === "github"
              ? "Redirecting..."
              : "Continue with GitHub"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

SignInForm.displayName = "SignInForm";
