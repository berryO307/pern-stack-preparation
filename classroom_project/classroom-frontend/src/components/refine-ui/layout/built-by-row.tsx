"use client";

import { Github, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { AUTHOR } from "@/constants/author.ts";

// Attribution, not the signed-in visitor's own identity - kept as its own
// row below SidebarUserMenu (separated by its own Separator in sidebar.tsx)
// so a visitor never mistakes this for their own profile links.
export function BuiltByRow() {
  const { open, isMobile } = useSidebar();
  const collapsed = !open && !isMobile;

  const links = [
    { href: AUTHOR.linkedinUrl, label: `${AUTHOR.name} on LinkedIn`, Icon: Linkedin },
    { href: AUTHOR.githubUrl, label: `${AUTHOR.name} on GitHub`, Icon: Github },
  ];

  return (
    <div
      className={cn(
        "flex items-center gap-1",
        collapsed ? "flex-col" : "justify-between",
      )}
    >
      {!collapsed && (
        <span className="truncate text-xs text-muted-foreground">
          Built by <span className="font-medium text-foreground">{AUTHOR.name}</span>
        </span>
      )}
      <TooltipProvider>
        <div className={cn("flex items-center gap-0.5", collapsed && "flex-col")}>
          {links.map(({ href, label, Icon }) => (
            <Tooltip key={href}>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" asChild>
                  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
                    <Icon className="size-3.5 text-muted-foreground transition-colors hover:text-foreground" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side={collapsed ? "right" : "top"}>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}

BuiltByRow.displayName = "BuiltByRow";
