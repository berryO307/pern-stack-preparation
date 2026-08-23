"use client";

import { useGetIdentity, useLogout } from "@refinedev/core";
import { LogOutIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import { useSidebar } from "@/components/ui/sidebar.tsx";
import { endRumSession } from "@/lib/rum.ts";
import { cn } from "@/lib/utils.ts";

type Identity = {
  id: string;
  name: string;
  fullName?: string;
  email: string;
  avatar?: string;
  role?: string;
};

const getInitials = (name = "") => {
  const names = name.trim().split(/\s+/);
  let initials = names[0]?.substring(0, 1).toUpperCase() ?? "";
  if (names.length > 1) {
    initials += names[names.length - 1]!.substring(0, 1).toUpperCase();
  }
  return initials || "?";
};

export function SidebarUserMenu() {
  const { data: identity, isLoading } = useGetIdentity<Identity>();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const { open, isMobile } = useSidebar();
  const collapsed = !open && !isMobile;

  if (isLoading || !identity) {
    return (
      <div className={cn("flex items-center gap-2 px-1 py-1", collapsed && "justify-center")}>
        <Skeleton className="size-9 rounded-full shrink-0" />
        {!collapsed && (
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        )}
      </div>
    );
  }

  const displayName = identity.fullName || identity.name;

  const handleSignOut = () => {
    endRumSession();
    logout();
  };

  // Narrow icon rail - no room for an inline sign-out button or email text,
  // so this stays a click-to-reveal menu.
  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto w-full items-center justify-center rounded-md px-1.5 py-1.5">
            <Avatar className="size-9 shrink-0">
              {identity.avatar && <AvatarImage src={identity.avatar} alt={displayName} />}
              <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{identity.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} disabled={isLoggingOut} aria-label="Sign out">
            <LogOutIcon className="text-destructive" />
            <span className="text-destructive">{isLoggingOut ? "Signing out..." : "Sign out"}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Expanded sidebar - identity and sign-out are both visible at a glance
  // rather than behind a click-to-reveal menu, since sign-out is the action
  // a user reaches for most often here. The email still has to truncate at
  // this width (a long address like a full Gmail address won't fit), so a
  // tooltip surfaces the untruncated value on hover/focus instead of just
  // cutting it off with no way to see the rest.
  return (
    <div className="flex items-center gap-2 px-1.5 py-1.5">
      <Avatar className="size-9 shrink-0">
        {identity.avatar && <AvatarImage src={identity.avatar} alt={displayName} />}
        <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium">{displayName}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="truncate text-xs text-muted-foreground">{identity.email}</p>
          </TooltipTrigger>
          <TooltipContent side="top" align="start">
            {identity.email}
          </TooltipContent>
        </Tooltip>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={handleSignOut}
        disabled={isLoggingOut}
        aria-label="Sign out"
      >
        <LogOutIcon />
      </Button>
    </div>
  );
}

SidebarUserMenu.displayName = "SidebarUserMenu";
