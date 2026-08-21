"use client";

import { useGetIdentity, useLogout } from "@refinedev/core";
import { LogOutIcon, Monitor, Moon, Sun } from "lucide-react";
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu.tsx";
import { useSidebar } from "@/components/ui/sidebar.tsx";
import { useTheme } from "@/components/refine-ui/theme/theme-provider.tsx";
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
  const { theme, setTheme } = useTheme();
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-auto w-full items-center gap-2 rounded-md px-1.5 py-1.5",
            collapsed ? "justify-center" : "justify-start"
          )}
        >
          <Avatar className="size-9 shrink-0">
            {identity.avatar && <AvatarImage src={identity.avatar} alt={displayName} />}
            <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{identity.email}</p>
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{identity.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun />
            <span>Light</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon />
            <span>Dark</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor />
            <span>System</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            endRumSession();
            logout();
          }}
          disabled={isLoggingOut}
          aria-label="Sign out"
        >
          <LogOutIcon className="text-destructive" />
          <span className="text-destructive">
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

SidebarUserMenu.displayName = "SidebarUserMenu";
