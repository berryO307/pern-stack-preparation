"use client";

import { Coffee } from "lucide-react";
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

// Sits above SidebarUserMenu, not inside BuiltByRow below it - a QR code is
// worth its own visual weight, not one more icon squeezed into the
// attribution row. Collapses to just the coffee icon when the sidebar is
// icon-only, same width budget BuiltByRow already respects.
export function BuyMeACoffeeCard() {
  const { open, isMobile } = useSidebar();
  const collapsed = !open && !isMobile;

  if (collapsed) {
    return (
      <div className="flex justify-center pb-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" asChild>
                <a
                  href={AUTHOR.buyMeACoffeeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Buy me a coffee"
                >
                  <Coffee className="size-3.5 text-muted-foreground transition-colors hover:text-foreground" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Buy me a coffee</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <a
      href={AUTHOR.buyMeACoffeeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "mb-2 flex items-center gap-2 rounded-lg border border-border p-2",
        "bg-muted/40 transition-colors hover:bg-muted",
      )}
    >
      {/* QR codes need dark modules on a light ground to stay scannable
          regardless of the app's own theme, so the backing plate is a fixed
          white, not a token that could flip in dark mode. */}
      <img
        src="/bmc_qr.png"
        alt="Buy me a coffee QR code"
        className="size-11 shrink-0 rounded-md border border-border bg-white p-0.5"
      />
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-xs font-medium text-foreground">
          <Coffee className="size-3.5" />
          Enjoying this?
        </p>
        <p className="truncate text-xs text-muted-foreground">Buy me a coffee</p>
      </div>
    </a>
  );
}

BuyMeACoffeeCard.displayName = "BuyMeACoffeeCard";
